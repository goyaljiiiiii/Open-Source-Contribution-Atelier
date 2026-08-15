"""
Git diff challenge lesson plugin.

Validates a user-submitted unified diff by parsing it (stdlib only,
hand-rolled hunk parser) and applying it in-memory to a provided "before"
text, then comparing the result to an expected "after" text. Deliberately
does NOT shell out to `patch` or `git apply` on arbitrary user-submitted
diff text — that would mean executing an external process against
untrusted input with file-write side effects, which is unnecessary risk
for what's fundamentally a text-transformation comparison.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from .plugins import LessonPlugin, registry

_HUNK_HEADER_PATTERN = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


class DiffParseError(Exception):
    """Raised when a submitted diff can't be parsed as a valid unified diff."""


class DiffApplyError(Exception):
    """Raised when a parsed diff can't be cleanly applied to the given input (context mismatch)."""


def _parse_hunks(diff_text: str) -> List[Dict[str, Any]]:
    """
    Parse a unified diff body into a list of hunks, each with the
    original starting line number and the ordered list of
    (op, content) lines where op is ' ' (context), '-' (removed), or
    '+' (added).
    """
    lines = diff_text.split("\n")
    hunks = []
    i = 0

    while i < len(lines):
        line = lines[i]
        match = _HUNK_HEADER_PATTERN.match(line)
        if not match:
            i += 1
            continue

        old_start = int(match.group(1))
        hunk_lines: List[Tuple[str, str]] = []
        i += 1

        while i < len(lines) and not _HUNK_HEADER_PATTERN.match(lines[i]):
            body_line = lines[i]
            if body_line == "":
                i += 1
                continue
            op = body_line[0]
            if op not in (" ", "-", "+"):
                # End of this diff's hunk content (e.g. hit a new file
                # header or trailing content) — stop this hunk here.
                break
            hunk_lines.append((op, body_line[1:]))
            i += 1

        if not hunk_lines:
            raise DiffParseError(f"hunk at line {i} has no content lines")

        hunks.append({"old_start": old_start, "lines": hunk_lines})

    if not hunks:
        raise DiffParseError("no valid @@ hunk headers found in submitted diff")

    return hunks


def _apply_hunks(before_lines: List[str], hunks: List[Dict[str, Any]]) -> List[str]:
    """
    Apply parsed hunks to before_lines, returning the resulting lines.
    Raises DiffApplyError if a hunk's context/removed lines don't match
    the actual content at the claimed position.
    """
    result: List[str] = []
    cursor = 0  # 0-indexed position in before_lines

    for hunk in hunks:
        target_start = hunk["old_start"] - 1  # convert to 0-indexed

        if target_start < cursor:
            raise DiffApplyError(f"hunk starting at line {hunk['old_start']} overlaps a previous hunk")

        # Copy through unchanged lines before this hunk starts
        result.extend(before_lines[cursor:target_start])
        cursor = target_start

        for op, content in hunk["lines"]:
            if op == " ":
                if cursor >= len(before_lines) or before_lines[cursor] != content:
                    raise DiffApplyError(
                        f"context line mismatch at original line {cursor + 1}: "
                        f"expected {content!r}, found {before_lines[cursor] if cursor < len(before_lines) else '<EOF>'!r}"
                    )
                result.append(content)
                cursor += 1
            elif op == "-":
                if cursor >= len(before_lines) or before_lines[cursor] != content:
                    raise DiffApplyError(
                        f"removal line mismatch at original line {cursor + 1}: "
                        f"expected to remove {content!r}, found {before_lines[cursor] if cursor < len(before_lines) else '<EOF>'!r}"
                    )
                cursor += 1
            elif op == "+":
                result.append(content)

    result.extend(before_lines[cursor:])
    return result


class GitDiffChallengePlugin(LessonPlugin):
    """
    Lesson plugin for diff/patch-writing challenges.

    Expected submission data shape:
    {
        "submitted_diff": "@@ -1,3 +1,3 @@\\n line one\\n-line two\\n+line TWO\\n line three",
        "before_text": "line one\\nline two\\nline three",
        "expected_after_text": "line one\\nline TWO\\nline three"
    }
    """

    identifier = "git_diff_challenge"
    version = "1.0"
    name = "Git Diff Challenge"
    description = (
        "Write a unified diff that transforms a given 'before' text into "
        "an expected 'after' text — validated by actually parsing and "
        "applying the diff in-memory (no shelling out to patch/git apply)."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        for key in ("submitted_diff", "before_text", "expected_after_text"):
            if not isinstance(data.get(key), str):
                return False
        return bool(data["submitted_diff"].strip())

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        before_lines = data["before_text"].split("\n")
        expected_after_lines = data["expected_after_text"].split("\n")

        try:
            hunks = _parse_hunks(data["submitted_diff"])
        except DiffParseError:
            # Doesn't even parse as a valid diff — no credit.
            return 0.0

        try:
            actual_after_lines = _apply_hunks(before_lines, hunks)
        except DiffApplyError:
            # Parses correctly (real diff syntax understood) but doesn't
            # apply cleanly (context/line-number mistakes) — partial
            # credit for demonstrating correct diff *format* understanding.
            return 30.0

        if actual_after_lines == expected_after_lines:
            return 100.0

        # Applied cleanly but produced the wrong result — understands
        # diff mechanics but got the actual edit content wrong.
        return 50.0


registry.register(GitDiffChallengePlugin)
