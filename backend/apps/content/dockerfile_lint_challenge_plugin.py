"""
Dockerfile lint challenge lesson plugin.

Validates a user-submitted Dockerfile against container best-practice
rules via static text analysis only — never builds or runs the
submitted Dockerfile (no Docker daemon dependency, and safe regardless
of submitted content).
"""

import re
from typing import Any, Dict, List, Tuple

from .plugins import LessonPlugin, registry

_FROM_PATTERN = re.compile(r"^\s*FROM\s+(\S+)", re.IGNORECASE)
_USER_PATTERN = re.compile(r"^\s*USER\s+(\S+)", re.IGNORECASE)
_RUN_APT_INSTALL_PATTERN = re.compile(r"^\s*RUN\s+.*apt-get\s+install", re.IGNORECASE)
_APT_CLEANUP_PATTERN = re.compile(r"rm\s+-rf\s+/var/lib/apt/lists", re.IGNORECASE)
_APT_UPDATE_SAME_LINE_PATTERN = re.compile(r"apt-get\s+update", re.IGNORECASE)
_COPY_DOT_DOT_PATTERN = re.compile(r"^\s*COPY\s+\.\s+\.\s*$", re.IGNORECASE)
_EXPOSE_PATTERN = re.compile(r"^\s*EXPOSE\s+(\d+)", re.IGNORECASE)


def _check_no_latest_tag(lines: List[str]) -> List[str]:
    """FROM images should be pinned to a specific version, not :latest or untagged (implicit latest)."""
    errors = []
    for i, line in enumerate(lines):
        match = _FROM_PATTERN.match(line)
        if match:
            image = match.group(1)
            if ":" not in image or image.endswith(":latest"):
                errors.append(f"line {i + 1}: base image '{image}' is unpinned or uses ':latest' — pin to a specific version")
    return errors


def _check_has_non_root_user(lines: List[str]) -> List[str]:
    """A USER instruction switching away from root should be present."""
    for line in lines:
        match = _USER_PATTERN.match(line)
        if match and match.group(1).lower() not in ("root", "0"):
            return []
    return ["no USER instruction found switching away from root — container will run as root by default"]


def _check_apt_cleanup(lines: List[str]) -> List[str]:
    """apt-get install RUN commands should combine update+install+cleanup in one layer, or clean up after."""
    errors = []
    for i, line in enumerate(lines):
        if _RUN_APT_INSTALL_PATTERN.match(line):
            has_update = bool(_APT_UPDATE_SAME_LINE_PATTERN.search(line))
            has_cleanup = bool(_APT_CLEANUP_PATTERN.search(line))
            if not has_update:
                errors.append(f"line {i + 1}: 'apt-get install' without 'apt-get update' in the same RUN layer (stale/missing package index risk)")
            if not has_cleanup:
                errors.append(f"line {i + 1}: 'apt-get install' without cleaning up /var/lib/apt/lists afterward (bloats image layer)")
    return errors


def _check_copy_context(lines: List[str]) -> List[str]:
    """Warn (not hard-fail) on `COPY . .` which copies the entire build context."""
    warnings = []
    for i, line in enumerate(lines):
        if _COPY_DOT_DOT_PATTERN.match(line):
            warnings.append(f"line {i + 1}: 'COPY . .' copies the entire build context — consider a .dockerignore or more specific COPY paths")
    return warnings


def _check_explicit_expose(lines: List[str]) -> List[str]:
    """At least one EXPOSE instruction should be present for documentation/clarity."""
    for line in lines:
        if _EXPOSE_PATTERN.match(line):
            return []
    return ["no EXPOSE instruction found — container's listening port isn't documented in the Dockerfile"]


class DockerfileLintChallengePlugin(LessonPlugin):
    """
    Lesson plugin for Dockerfile best-practices challenges.

    Expected submission data shape:
    {
        "submitted_dockerfile": "FROM python:3.11-slim\\nRUN ...\\n..."
    }

    Checks are static text analysis only — the submitted Dockerfile is
    never built or run.
    """

    identifier = "dockerfile_lint_challenge"
    version = "1.0"
    name = "Dockerfile Lint Challenge"
    description = (
        "Write a Dockerfile following container best practices — pinned "
        "base image, non-root user, apt cleanup, minimal build context, "
        "explicit EXPOSE. Static analysis only, no build/run."
    )

    # (check_function, is_hard_requirement) — the COPY-context check is a
    # warning, not a hard requirement, so it's weighted lower in scoring.
    _HARD_CHECKS = (
        _check_no_latest_tag,
        _check_has_non_root_user,
        _check_apt_cleanup,
        _check_explicit_expose,
    )
    _SOFT_CHECKS = (_check_copy_context,)

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        submitted = data.get("submitted_dockerfile")
        if not isinstance(submitted, str) or not submitted.strip():
            return False
        # Must have at least one FROM instruction to be a plausible Dockerfile
        return any(_FROM_PATTERN.match(line) for line in submitted.split("\n"))

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        lines = data["submitted_dockerfile"].split("\n")

        hard_passed = 0
        for check_fn in cls._HARD_CHECKS:
            if not check_fn(lines):
                hard_passed += 1
        hard_score = (hard_passed / len(cls._HARD_CHECKS)) * 90.0

        soft_passed = 0
        for check_fn in cls._SOFT_CHECKS:
            if not check_fn(lines):
                soft_passed += 1
        soft_score = (soft_passed / len(cls._SOFT_CHECKS)) * 10.0 if cls._SOFT_CHECKS else 0.0

        return round(hard_score + soft_score, 2)

    @classmethod
    def get_lint_warnings(cls, data: Dict[str, Any]) -> Tuple[List[str], List[str]]:
        """Non-interface helper: returns (hard_errors, soft_warnings) for learner feedback."""
        if not cls.validate_submission(data):
            return (["Submission is not a valid Dockerfile (no FROM instruction found)."], [])

        lines = data["submitted_dockerfile"].split("\n")
        hard_errors = []
        for check_fn in cls._HARD_CHECKS:
            hard_errors.extend(check_fn(lines))

        soft_warnings = []
        for check_fn in cls._SOFT_CHECKS:
            soft_warnings.extend(check_fn(lines))

        return hard_errors, soft_warnings


registry.register(DockerfileLintChallengePlugin)
