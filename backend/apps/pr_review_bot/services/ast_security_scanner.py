"""
AST security scanner for PR review bot inline annotations.

Reuses issue_quality security rules and formats findings for GitHub-style review comments.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from apps.issue_quality.services.complexity_analyzer import analyze_complexity
from apps.issue_quality.services.security_rules import (
    SecurityFinding,
    compute_risk_score,
    run_security_rules,
)

logger = logging.getLogger(__name__)

_SEVERITY_TO_LEVEL = {
    "Critical": "error",
    "Medium": "warning",
    "Low": "notice",
}


def _finding_to_annotation(finding: SecurityFinding) -> Dict[str, Any]:
    """Convert a SecurityFinding to PR bot inline annotation format."""
    return {
        "path": finding.path,
        "start_line": finding.lineno,
        "end_line": finding.lineno,
        "annotation_level": _SEVERITY_TO_LEVEL.get(finding.severity, "warning"),
        "title": finding.rule.replace("_", " ").title(),
        "message": finding.message,
        "raw_details": finding.snippet,
    }


def _complexity_to_annotation(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "path": item["path"],
        "start_line": item["lineno"],
        "end_line": item["lineno"],
        "annotation_level": "warning" if item["complexity"] <= 20 else "error",
        "title": f"Complexity: {item.get('asymptotic_hint') or item['kind']}",
        "message": item.get("message", ""),
        "raw_details": "",
    }


class AstSecurityScanner:
    """
    Scan PR changed files and produce inline review annotations.
    """

    def scan_files(self, files: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Scan files and return annotations + risk score.

        Each file: {"path": "...", "content": "..."}
        """
        security_findings: List[SecurityFinding] = []
        complexity_items: List[Dict[str, Any]] = []

        for item in files:
            path = item.get("path", "")
            content = item.get("content", "")
            if not path:
                continue
            security_findings.extend(run_security_rules(path, content))
            for c in analyze_complexity(path, content):
                complexity_items.append(c.to_dict())

        annotations = [_finding_to_annotation(f) for f in security_findings]
        annotations.extend(_complexity_to_annotation(c) for c in complexity_items)

        risk_score = compute_risk_score(security_findings)

        return {
            "risk_score": risk_score,
            "annotations": annotations,
            "finding_count": len(security_findings),
            "complexity_count": len(complexity_items),
        }

    def scan_file(self, path: str, content: str) -> List[Dict[str, Any]]:
        """Scan a single file and return inline annotations only."""
        result = self.scan_files([{"path": path, "content": content}])
        return result["annotations"]
