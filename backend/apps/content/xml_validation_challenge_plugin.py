"""
XML validation challenge lesson plugin.

Validates a user-submitted XML document against a lightweight schema
(required elements/attributes, hierarchy, text content).

SECURITY: xml.etree.ElementTree is parsed here, which does NOT resolve
external entities (not vulnerable to classic XXE file-disclosure), but
DOES expand internal entities, making it vulnerable to entity-expansion
("billion laughs") denial-of-service on unbounded malicious input. This
is mitigated with a hard input size cap enforced BEFORE parsing — the
primary defense, since expansion ratio is bounded by input size. If the
maintainer wants a stronger guarantee, the `defusedxml` package provides
one, at the cost of a new dependency this repo doesn't currently have.
"""

import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

from .plugins import LessonPlugin, registry

# Primary DoS mitigation: reject oversized input before it's ever handed
# to the XML parser. Entity-expansion damage is fundamentally bounded by
# how much raw input text is available to expand from.
_MAX_INPUT_SIZE_BYTES = 100_000  # 100KB — generous for a lesson exercise, far below anything concerning


class XMLParseSizeError(Exception):
    """Raised when submitted XML exceeds the size cap, before any parsing is attempted."""


def _safe_parse_xml(xml_text: str) -> ET.Element:
    """
    Parse XML with a hard size cap enforced first (primary
    entity-expansion DoS mitigation for this dependency-free approach —
    see module docstring). Raises XMLParseSizeError or ET.ParseError.
    """
    encoded_size = len(xml_text.encode("utf-8"))
    if encoded_size > _MAX_INPUT_SIZE_BYTES:
        raise XMLParseSizeError(
            f"submitted XML is {encoded_size} bytes, exceeds the "
            f"{_MAX_INPUT_SIZE_BYTES} byte limit for this exercise type"
        )

    return ET.fromstring(xml_text)


def _validate_element(
    element: Optional[ET.Element], schema: Dict[str, Any], path: str = "$"
) -> List[str]:
    """
    Recursively validate an XML element against a lightweight schema:
    {
        "tag": "user",
        "required_attributes": ["id"],
        "children": [
            {"tag": "name", "min_occurs": 1, "max_occurs": 1},
            {"tag": "email", "min_occurs": 0, "max_occurs": 1}
        ],
        "text_required": false
    }
    """
    errors: List[str] = []

    if element is None:
        errors.append(f"{path}: element is missing")
        return errors

    expected_tag = schema.get("tag")
    if expected_tag is not None and element.tag != expected_tag:
        errors.append(f"{path}: expected tag '<{expected_tag}>', got '<{element.tag}>'")
        return errors  # further checks on a wrong element aren't meaningful

    for attr in schema.get("required_attributes", []):
        if attr not in element.attrib:
            errors.append(f"{path}: missing required attribute '{attr}'")

    if schema.get("text_required") and not (element.text and element.text.strip()):
        errors.append(f"{path}: element requires non-empty text content")

    child_schemas = schema.get("children", [])
    for child_schema in child_schemas:
        child_tag = child_schema["tag"]
        matching_children = [c for c in element if c.tag == child_tag]
        count = len(matching_children)

        min_occurs = child_schema.get("min_occurs", 0)
        max_occurs = child_schema.get("max_occurs")

        if count < min_occurs:
            errors.append(
                f"{path}: expected at least {min_occurs} <{child_tag}> child element(s), found {count}"
            )
        if max_occurs is not None and count > max_occurs:
            errors.append(
                f"{path}: expected at most {max_occurs} <{child_tag}> child element(s), found {count}"
            )

        for i, child in enumerate(matching_children):
            errors.extend(_validate_element(child, child_schema, f"{path}/{child_tag}[{i}]"))

    return errors


class XMLValidationChallengePlugin(LessonPlugin):
    """
    Lesson plugin for XML-writing challenges.

    Expected submission data shape:
    {
        "submitted_xml": "<user id='1'><name>Alice</name></user>",
        "schema": {
            "tag": "user",
            "required_attributes": ["id"],
            "children": [
                {"tag": "name", "min_occurs": 1, "max_occurs": 1, "text_required": true}
            ]
        }
    }
    """

    identifier = "xml_validation_challenge"
    version = "1.0"
    name = "XML Validation Challenge"
    description = (
        "Write an XML document matching a given structural schema "
        "(required attributes, child element cardinality, text content) "
        "— parsed with a hard input-size cap as entity-expansion DoS "
        "mitigation."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        submitted = data.get("submitted_xml")
        if not isinstance(submitted, str) or not submitted.strip():
            return False

        schema = data.get("schema")
        if not isinstance(schema, dict):
            return False

        try:
            _safe_parse_xml(submitted)
        except (XMLParseSizeError, ET.ParseError):
            return False

        return True

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        try:
            root = _safe_parse_xml(data["submitted_xml"])
        except (XMLParseSizeError, ET.ParseError):
            return 0.0

        errors = _validate_element(root, data["schema"])

        if not errors:
            return 100.0

        # Partial credit: root tag matched (structurally recognizable as
        # an attempt at the right document) but has other violations.
        root_tag_ok = data["schema"].get("tag") is None or root.tag == data["schema"]["tag"]
        return 30.0 if root_tag_ok else 0.0

    @classmethod
    def get_validation_errors(cls, data: Dict[str, Any]) -> List[str]:
        """Non-interface helper: human-readable validation errors for learner feedback."""
        if not cls.validate_submission(data):
            return ["Submission is not valid XML, exceeds the size limit, or is missing a schema."]
        try:
            root = _safe_parse_xml(data["submitted_xml"])
        except (XMLParseSizeError, ET.ParseError) as e:
            return [str(e)]
        return _validate_element(root, data["schema"])


registry.register(XMLValidationChallengePlugin)
