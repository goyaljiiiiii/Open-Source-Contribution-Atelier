"""
Semantic Versioning challenge lesson plugin.

Validates a submitted version bump against SemVer 2.0.0 rules
(semver.org): given a current version and a change type, checks whether
the submitted next version follows correct MAJOR/MINOR/PATCH bump rules.
Also supports standalone format-validation mode for raw SemVer string
compliance, independent of any bump logic.
"""

import re
from typing import Any, Dict, Optional, Tuple

from .plugins import LessonPlugin, registry

# SemVer 2.0.0 official regex (from semver.org), used for format validation.
_SEMVER_PATTERN = re.compile(
    r"^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
    r"(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)"
    r"(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)


def _parse_semver(version: str) -> Optional[Dict[str, Any]]:
    """Parse a version string into its components, or None if it doesn't match SemVer format."""
    match = _SEMVER_PATTERN.match(version)
    if not match:
        return None
    groups = match.groupdict()
    return {
        "major": int(groups["major"]),
        "minor": int(groups["minor"]),
        "patch": int(groups["patch"]),
        "prerelease": groups["prerelease"],
        "buildmetadata": groups["buildmetadata"],
    }


def _expected_bump(current: Dict[str, Any], change_type: str) -> Tuple[int, int, int]:
    """Compute the expected (major, minor, patch) tuple for a correct SemVer bump."""
    major, minor, patch = current["major"], current["minor"], current["patch"]

    if change_type == "major":
        return (major + 1, 0, 0)
    elif change_type == "minor":
        return (major, minor + 1, 0)
    elif change_type == "patch":
        return (major, minor, patch + 1)
    else:
        raise ValueError(f"unknown change_type: {change_type}")


class SemanticVersioningChallengePlugin(LessonPlugin):
    """
    Lesson plugin for SemVer literacy challenges. Two modes:

    Mode "bump" — validates a version bump follows correct SemVer rules:
    {
        "mode": "bump",
        "current_version": "1.4.2",
        "change_type": "minor",
        "submitted_next_version": "1.5.0"
    }

    Mode "format" — validates raw SemVer string format compliance:
    {
        "mode": "format",
        "submitted_version": "1.0.0-alpha.1+build.123"
    }
    """

    identifier = "semver_challenge"
    version = "1.0"
    name = "Semantic Versioning Challenge"
    description = (
        "Bump a version correctly per SemVer 2.0.0 rules, or validate "
        "raw SemVer string format compliance — pure rule-based checking, "
        "no dependency."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        mode = data.get("mode")

        if mode == "bump":
            if not isinstance(data.get("current_version"), str):
                return False
            if data.get("change_type") not in ("major", "minor", "patch"):
                return False
            if not isinstance(data.get("submitted_next_version"), str):
                return False
            if _parse_semver(data["current_version"]) is None:
                return False
            return True

        elif mode == "format":
            return isinstance(data.get("submitted_version"), str)

        return False

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        mode = data["mode"]

        if mode == "format":
            parsed = _parse_semver(data["submitted_version"])
            return 100.0 if parsed is not None else 0.0

        # mode == "bump"
        current = _parse_semver(data["current_version"])
        submitted_next = _parse_semver(data["submitted_next_version"])

        if submitted_next is None:
            # Not even valid SemVer format — no credit
            return 0.0

        try:
            expected_major, expected_minor, expected_patch = _expected_bump(current, data["change_type"])
        except ValueError:
            return 0.0

        submitted_tuple = (submitted_next["major"], submitted_next["minor"], submitted_next["patch"])
        expected_tuple = (expected_major, expected_minor, expected_patch)

        if submitted_tuple == expected_tuple:
            return 100.0

        # Partial credit: got the format right and moved in a plausible
        # direction (bumped SOME component) but not the exact correct one
        # — e.g. bumped patch when minor was expected. Full miss (didn't
        # bump at all, or bumped backward) gets 0.
        current_tuple = (current["major"], current["minor"], current["patch"])
        if submitted_tuple > current_tuple:
            return 30.0

        return 0.0


registry.register(SemanticVersioningChallengePlugin)