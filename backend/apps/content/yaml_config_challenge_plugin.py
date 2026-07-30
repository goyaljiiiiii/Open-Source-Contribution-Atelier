"""
YAML config challenge lesson plugin.

Validates a user-submitted YAML document against a lightweight schema,
reusing the same validation approach as JSONValidationChallengePlugin
(#27) against the parsed structure. Requires PyYAML — confirm it's
already a project dependency before merging (see solution notes), and
add explicitly with maintainer sign-off if not.

SECURITY: uses yaml.safe_load() exclusively. Never yaml.load() with the
default loader, which permits arbitrary Python object construction via
YAML tags and would allow a malicious submission to execute code on
deserialization.
"""

from typing import Any, Dict, List

import yaml

from .plugins import LessonPlugin, registry

_TYPE_MAP = {
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "object": dict,
    "array": list,
    "null": type(None),
}


def _validate_against_schema(value: Any, schema: Dict[str, Any], path: str = "$") -> List[str]:
    """
    Recursively validate value against schema. Same lightweight subset
    approach as JSONValidationChallengePlugin (#27): type, required,
    properties, items, enum, minimum/maximum, minLength/maxLength — not
    full JSON-Schema-spec compliant, deliberately so, to avoid a second
    new dependency (this file already needs PyYAML; adding jsonschema on
    top for schema validation specifically would be two new dependencies
    for one plugin).
    """
    errors: List[str] = []

    expected_type = schema.get("type")
    if expected_type is not None:
        py_type = _TYPE_MAP.get(expected_type)
        if py_type is None:
            errors.append(f"{path}: unknown schema type '{expected_type}'")
        elif expected_type == "integer" and isinstance(value, bool):
            errors.append(f"{path}: expected integer, got boolean")
        elif not isinstance(value, py_type):
            errors.append(f"{path}: expected {expected_type}, got {type(value).__name__}")
            return errors

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value {value!r} not in allowed enum {schema['enum']!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: {value} is below minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: {value} is above maximum {schema['maximum']}")

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: length {len(value)} is below minLength {schema['minLength']}")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{path}: length {len(value)} is above maxLength {schema['maxLength']}")

    if isinstance(value, dict) and "properties" in schema:
        properties = schema["properties"]
        required = schema.get("required", [])

        for req_key in required:
            if req_key not in value:
                errors.append(f"{path}: missing required property '{req_key}'")

        for key, sub_value in value.items():
            if key in properties:
                errors.extend(_validate_against_schema(sub_value, properties[key], f"{path}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}: unexpected additional property '{key}'")

    if isinstance(value, list) and "items" in schema:
        item_schema = schema["items"]
        for i, item in enumerate(value):
            errors.extend(_validate_against_schema(item, item_schema, f"{path}[{i}]"))

    return errors


class YAMLConfigChallengePlugin(LessonPlugin):
    """
    Lesson plugin for YAML config-writing challenges.

    Expected submission data shape:
    {
        "submitted_yaml": "name: my-service\\nport: 8080\\n",
        "schema": {
            "type": "object",
            "required": ["name", "port"],
            "properties": {
                "name": {"type": "string", "minLength": 1},
                "port": {"type": "integer", "minimum": 1, "maximum": 65535}
            }
        }
    }
    """

    identifier = "yaml_config_challenge"
    version = "1.0"
    name = "YAML Config Challenge"
    description = (
        "Write a YAML config document matching a given schema, parsed "
        "safely (yaml.safe_load only) and validated against a "
        "lightweight schema subset shared with the JSON plugin's approach."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        submitted = data.get("submitted_yaml")
        if not isinstance(submitted, str) or not submitted.strip():
            return False

        schema = data.get("schema")
        if not isinstance(schema, dict):
            return False

        try:
            parsed = yaml.safe_load(submitted)
        except yaml.YAMLError:
            return False

        # A YAML document that parses to None (empty) or a bare scalar
        # when an object/array schema was expected isn't a useful
        # submission — still let evaluate_progress's type check catch
        # the specific mismatch rather than rejecting here, so the
        # learner gets a specific type-mismatch error instead of a bare
        # "invalid submission."
        return True

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        try:
            parsed = yaml.safe_load(data["submitted_yaml"])
        except yaml.YAMLError:
            return 0.0

        schema = data["schema"]
        errors = _validate_against_schema(parsed, schema)

        if not errors:
            return 100.0

        required = schema.get("required", []) if isinstance(parsed, dict) else []
        if required:
            present = sum(1 for key in required if isinstance(parsed, dict) and key in parsed)
            structural_score = (present / len(required)) * 60.0
        else:
            structural_score = 0.0

        return round(structural_score, 2)

    @classmethod
    def get_validation_errors(cls, data: Dict[str, Any]) -> List[str]:
        """Non-interface helper: human-readable validation errors for learner feedback."""
        if not cls.validate_submission(data):
            return ["Submission is not valid YAML or is missing required fields."]
        try:
            parsed = yaml.safe_load(data["submitted_yaml"])
        except yaml.YAMLError as e:
            return [f"YAML parse error: {e}"]
        return _validate_against_schema(parsed, data["schema"])


registry.register(YAMLConfigChallengePlugin)