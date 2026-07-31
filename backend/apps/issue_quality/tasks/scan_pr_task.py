"""
Celery task: scan PR code files for security and complexity issues.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from celery import shared_task

from apps.issue_quality.services.ast_parser import parse_source
from apps.issue_quality.services.complexity_analyzer import analyze_complexity
from apps.issue_quality.services.security_rules import (
    compute_risk_score,
    findings_to_dicts,
    run_security_rules,
)

logger = logging.getLogger(__name__)


def _scan_files(files: List[Dict[str, str]]) -> Dict[str, Any]:
    """Core scan logic shared by task and synchronous callers."""
    all_security = []
    all_complexity = []
    ast_summaries: Dict[str, List[Dict[str, Any]]] = {}

    for item in files:
        path = item.get("path", "")
        content = item.get("content", "")
        if not path:
            continue

        nodes = parse_source(path, content)
        ast_summaries[path] = [
            {"type": n.type, "name": n.name, "lineno": n.lineno} for n in nodes
        ]

        security = run_security_rules(path, content)
        all_security.extend(security)

        complexity = analyze_complexity(path, content)
        all_complexity.extend(complexity)

    risk_score = compute_risk_score(all_security)

    return {
        "risk_score": risk_score,
        "security_findings": findings_to_dicts(all_security),
        "complexity_findings": [c.to_dict() for c in all_complexity],
        "ast_summaries": ast_summaries,
        "files_scanned": len(files),
    }


@shared_task(name="issue_quality.scan_pr_code")
def scan_pr_code(files: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Scan a list of PR files.

    Each file dict: {"path": "...", "content": "..."}
    """
    logger.info("Scanning %d file(s) for security/complexity", len(files))
    return _scan_files(files)


def scan_pr_code_sync(files: List[Dict[str, str]]) -> Dict[str, Any]:
    """Synchronous wrapper when Celery is not used."""
    return _scan_files(files)
