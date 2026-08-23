"""Parse Git diffs while preserving post-rename paths for review comments."""
from __future__ import annotations
from dataclasses import dataclass, field
import re
from typing import Optional

_DIFF_HEADER = re.compile(r"^diff --git a/(.*?) b/(.*?)$")
_HUNK_HEADER = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")

@dataclass
class DiffHunk:
    old_start: int
    old_count: int
    new_start: int
    new_count: int
    lines: list[str] = field(default_factory=list)

    def diff_positions(self) -> dict[int, int]:
        """Map post-image line numbers to one-based unified-diff positions."""
        result: dict[int, int] = {}
        new_line = self.new_start
        for position, line in enumerate(self.lines, start=1):
            marker = line[:1]
            if marker in (" ", "+"):
                result[new_line] = position
                new_line += 1
        return result

@dataclass
class FileDiff:
    old_path: Optional[str]
    new_path: Optional[str]
    old_mode: Optional[str] = None
    new_mode: Optional[str] = None
    renamed: bool = False
    hunks: list[DiffHunk] = field(default_factory=list)

    @property
    def path(self) -> Optional[str]:
        return self.new_path or self.old_path

    @property
    def mode_changed(self) -> bool:
        return bool(self.old_mode and self.new_mode and self.old_mode != self.new_mode)

    def position_for_line(self, line_number: int) -> Optional[int]:
        for hunk in self.hunks:
            position = hunk.diff_positions().get(line_number)
            if position is not None:
                return position
        return None

class GitDiffParser:
    """Parse multi-file Git/unified diffs, including rename and mode headers."""
    def parse(self, diff_text: str) -> list[FileDiff]:
        files: list[FileDiff] = []
        current: Optional[FileDiff] = None
        hunk: Optional[DiffHunk] = None
        for line in diff_text.splitlines():
            match = _DIFF_HEADER.match(line)
            if match:
                if current is not None:
                    files.append(current)
                current = FileDiff(match.group(1), match.group(2))
                hunk = None
                continue
            if current is None:
                continue
            if line.startswith("old mode "):
                current.old_mode = line[9:].strip(); continue
            if line.startswith("new mode "):
                current.new_mode = line[9:].strip(); continue
            if line.startswith("rename from "):
                current.old_path = line[12:].strip(); current.renamed = True; continue
            if line.startswith("rename to "):
                current.new_path = line[10:].strip(); current.renamed = True; continue
            if line.startswith("similarity index "):
                current.renamed = True; continue
            match = _HUNK_HEADER.match(line)
            if match:
                hunk = DiffHunk(
                    int(match.group(1)), int(match.group(2) or 1),
                    int(match.group(3)), int(match.group(4) or 1),
                )
                current.hunks.append(hunk)
                continue
            if hunk is not None and line[:1] in (" ", "+", "-"):
                hunk.lines.append(line)
        if current is not None:
            files.append(current)
        return files

    def file_for_comment(self, diff_text: str, path: str) -> Optional[FileDiff]:
        """Resolve a review comment against the destination path of a rename."""
        return next((f for f in self.parse(diff_text) if f.new_path == path), None)

    def map_comment(self, diff_text: str, path: str, line_number: int) -> Optional[dict[str, int | str]]:
        file_diff = self.file_for_comment(diff_text, path)
        if file_diff is None:
            return None
        position = file_diff.position_for_line(line_number)
        if position is None:
            return None
        return {"path": file_diff.path or path, "line": line_number, "position": position}

def parse_git_diff(diff_text: str) -> list[FileDiff]:
    return GitDiffParser().parse(diff_text)
