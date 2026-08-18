"""
Markdown lint challenge lesson plugin.

Validates a user-submitted Markdown document against structural
authoring rules: heading level jumps, unclosed code fences, malformed
link syntax, and inconsistent list markers within a block. This checks
Markdown SOURCE structure, not rendered output — no markdown-rendering
dependency needed.
"""

import re
from typing import Any, Dict, List, Tuple

from .plugins import LessonPlugin, registry

_HEADING_PATTERN = re.compile(r"^(#{1,6})\s+\S")
_CODE_FENCE_PATTERN = re.compile(r"^```")
_LIST_MARKER_PATTERN = re.compile(r"^(\s*)([-*+]|\d+\.)\s+\S")
_LINK_OPEN_PATTERN = re.compile(r"\[([^\]]*)\]")


def _check_heading_hierarchy(lines: List[str]) -> List[str]:
    """No heading level should jump by more than 1 from the previous heading."""
    errors = []
    last_level = 0
    for i, line in enumerate(lines):
        match = _HEADING_PATTERN.match(line)
        if match:
            level = len(match.group(1))
            if last_level != 0 and level > last_level + 1:
                errors.append(
                    f"line {i + 1}: heading level jumps from h{last_level} to h{level} "
                    f"(skips h{last_level + 1})"
                )
            last_level = level
    return errors


def _check_code_fences_closed(lines: List[str]) -> List[str]:
    """Every opened ``` fence must be closed."""
    errors = []
    open_fence_line = None
    for i, line in enumerate(lines):
        if _CODE_FENCE_PATTERN.match(line.strip()):
            if open_fence_line is None:
                open_fence_line = i + 1
            else:
                open_fence_line = None
    if open_fence_line is not None:
        errors.append(f"line {open_fence_line}: code fence opened but never closed")
    return errors


def _check_link_syntax(lines: List[str]) -> List[str]:
    """[text](url) — every [text] must be immediately followed by (url)."""
    errors = []
    for i, line in enumerate(lines):
        for match in _LINK_OPEN_PATTERN.finditer(line):
            end = match.end()
            if end >= len(line) or line[end] != "(":
                # Could be a plain [reference]-style link, only flag if it
                # looks like it was meant to be inline (has no matching
                # trailing "]:" reference-definition pattern either)
                rest_of_line = line[end:]
                if not rest_of_line.startswith(":") and not line.strip().startswith("[" + match.group(1) + "]:"):
                    errors.append(
                        f"line {i + 1}: '[{match.group(1)}]' not followed by '(url)' or a reference definition"
                    )
    return errors


def _check_list_marker_consistency(lines: List[str]) -> List[str]:
    """Within a contiguous list block, marker style shouldn't switch (e.g. - then *)."""
    errors = []
    current_marker = None
    block_start = None
    for i, line in enumerate(lines):
        match = _LIST_MARKER_PATTERN.match(line)
        if match:
            marker = match.group(2)
            normalized = "bullet" if marker in ("-", "*", "+") else "ordered"
            bullet_char = marker if normalized == "bullet" else None

            if current_marker is None:
                current_marker = bullet_char
                block_start = i + 1
            elif normalized == "bullet" and bullet_char != current_marker:
                errors.append(
                    f"line {i + 1}: list marker changed from '{current_marker}' to '{bullet_char}' "
                    f"within the same block (started line {block_start})"
                )
        else:
            if line.strip() == "":
                continue
            current_marker = None
            block_start = None
    return errors


def _run_all_checks(text: str) -> Tuple[int, int, List[str]]:
    """Returns (checks_passed, checks_total, all_error_messages)."""
    lines = text.split("\n")

    check_functions = [
        _check_heading_hierarchy,
        _check_code_fences_closed,
        _check_link_syntax,
        _check_list_marker_consistency,
    ]

    all_errors: List[str] = []
    passed = 0
    total = len(check_functions)

    for check_fn in check_functions:
        errors = check_fn(lines)
        if not errors:
            passed += 1
        all_errors.extend(errors)

    return passed, total, all_errors


class MarkdownLintChallengePlugin(LessonPlugin):
    """
    Lesson plugin for Markdown authoring correctness challenges.

    Expected submission data shape:
    {
        "submitted_markdown": "# Title\\n\\n### Skipped h2\\n..."
    }
    """

    identifier = "markdown_lint_challenge"
    version = "1.0"
    name = "Markdown Lint Challenge"
    description = (
        "Write Markdown with correct heading hierarchy, closed code "
        "fences, valid link syntax, and consistent list markers — "
        "structural checks only, no rendering."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        submitted = data.get("submitted_markdown")
        return isinstance(submitted, str) and bool(submitted.strip())

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        passed, total, _errors = _run_all_checks(data["submitted_markdown"])
        if total == 0:
            return 0.0
        return round((passed / total) * 100.0, 2)

    @classmethod
    def get_lint_errors(cls, data: Dict[str, Any]) -> List[str]:
        """Non-interface helper: line-numbered error messages for learner feedback."""
        if not cls.validate_submission(data):
            return ["Submission is empty or invalid."]
        _passed, _total, errors = _run_all_checks(data["submitted_markdown"])
        return errors


registry.register(MarkdownLintChallengePlugin)
