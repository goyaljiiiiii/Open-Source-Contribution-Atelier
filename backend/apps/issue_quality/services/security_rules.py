"""
Security rule engine for static code analysis.

Detects SQL injection, hardcoded secrets, unsafe eval/exec, etc.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Literal, Optional

Severity = Literal["Low", "Medium", "Critical"]

SECRET_NAMES = re.compile(
    r"(api[_-]?key|password|secret|token|auth[_-]?token|private[_-]?key|access[_-]?key)",
    re.IGNORECASE,
)

SQL_EXECUTE = re.compile(
    r"\.(execute|executemany|raw|extra)\s*\(",
    re.IGNORECASE,
)


@dataclass
class SecurityFinding:
    rule: str
    severity: Severity
    message: str
    path: str
    lineno: int
    snippet: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _snippet_at(content: str, lineno: int, context: int = 1) -> str:
    lines = content.splitlines()
    idx = lineno - 1
    start = max(0, idx - context)
    end = min(len(lines), idx + context + 1)
    return "\n".join(lines[start:end])


def _python_findings(path: str, content: str) -> List[SecurityFinding]:
    findings: List[SecurityFinding] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return findings

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            if func_name in ("eval", "exec"):
                findings.append(
                    SecurityFinding(
                        rule="unsafe_eval_exec",
                        severity="Critical",
                        message=f"Unsafe use of {func_name}()",
                        path=path,
                        lineno=node.lineno,
                        snippet=_snippet_at(content, node.lineno),
                    )
                )

            if func_name in ("execute", "executemany", "raw"):
                for arg in node.args:
                    if _is_dynamic_sql(arg):
                        findings.append(
                            SecurityFinding(
                                rule="sql_injection",
                                severity="Critical",
                                message="Potential SQL injection: dynamic string in execute()",
                                path=path,
                                lineno=node.lineno,
                                snippet=_snippet_at(content, node.lineno),
                            )
                        )

        if isinstance(node, ast.Assign):
            for target in node.targets:
                name = _assign_target_name(target)
                if name and SECRET_NAMES.search(name):
                    if isinstance(node.value, ast.Constant) and isinstance(
                        node.value.value, str
                    ):
                        if len(node.value.value) > 3:
                            findings.append(
                                SecurityFinding(
                                    rule="hardcoded_secret",
                                    severity="Critical",
                                    message=f"Hardcoded secret assigned to '{name}'",
                                    path=path,
                                    lineno=node.lineno,
                                    snippet=_snippet_at(content, node.lineno),
                                )
                            )

    return findings


def _assign_target_name(target: ast.expr) -> Optional[str]:
    if isinstance(target, ast.Name):
        return target.id
    if isinstance(target, ast.Attribute):
        return target.attr
    return None


def _is_dynamic_sql(node: ast.expr) -> bool:
    if isinstance(node, ast.JoinedStr):
        return True
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return True
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Attribute) and node.func.attr == "format":
            return True
        if isinstance(node.func, ast.Name) and node.func.id in ("format", "str"):
            return True
    return False


def _regex_findings(path: str, content: str) -> List[SecurityFinding]:
    findings: List[SecurityFinding] = []
    lines = content.splitlines()

    patterns: List[tuple[str, Severity, str, re.Pattern[str]]] = [
        (
            "sql_injection",
            "Critical",
            "Potential SQL injection: string concatenation in SQL execute",
            re.compile(r"(execute|query)\s*\(\s*[`'\"].*\+", re.IGNORECASE),
        ),
        (
            "sql_injection",
            "Critical",
            "Potential SQL injection: template literal in execute",
            re.compile(r"(execute|query)\s*\(\s*`[^`]*\$\{", re.IGNORECASE),
        ),
        (
            "unsafe_eval_exec",
            "Critical",
            "Unsafe use of eval()",
            re.compile(r"\beval\s*\("),
        ),
        (
            "unsafe_eval_exec",
            "Critical",
            "Unsafe use of exec()",
            re.compile(r"\bexec\s*\("),
        ),
        (
            "hardcoded_secret",
            "Critical",
            "Hardcoded credential detected",
            re.compile(
                r"(api[_-]?key|password|secret|token)\s*[:=]\s*['\"][^'\"]{4,}['\"]",
                re.IGNORECASE,
            ),
        ),
    ]

    for i, line in enumerate(lines, start=1):
        for rule, severity, message, pattern in patterns:
            if pattern.search(line):
                findings.append(
                    SecurityFinding(
                        rule=rule,
                        severity=severity,
                        message=message,
                        path=path,
                        lineno=i,
                        snippet=_snippet_at(content, i),
                    )
                )

        if SQL_EXECUTE.search(line) and ("+" in line or "${" in line or ".format(" in line):
            findings.append(
                SecurityFinding(
                    rule="sql_injection",
                    severity="Critical",
                    message="Potential SQL injection: dynamic string in execute()",
                    path=path,
                    lineno=i,
                    snippet=_snippet_at(content, i),
                )
            )

        assign_match = re.match(
            r"^\s*(?:const|let|var)?\s*(\w+)\s*=\s*['\"][^'\"]{4,}['\"]",
            line,
        )
        if assign_match and SECRET_NAMES.search(assign_match.group(1)):
            findings.append(
                SecurityFinding(
                    rule="hardcoded_secret",
                    severity="Critical",
                    message=f"Hardcoded secret assigned to '{assign_match.group(1)}'",
                    path=path,
                    lineno=i,
                    snippet=_snippet_at(content, i),
                )
            )

    return findings


def run_security_rules(path: str, content: str) -> List[SecurityFinding]:
    """Run all security rules against a single file."""
    findings: List[SecurityFinding] = []
    if path.lower().endswith(".py"):
        findings.extend(_python_findings(path, content))
    findings.extend(_regex_findings(path, content))

    seen = set()
    unique: List[SecurityFinding] = []
    for f in findings:
        key = (f.rule, f.path, f.lineno, f.message)
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


def findings_to_dicts(findings: List[SecurityFinding]) -> List[Dict[str, Any]]:
    return [f.to_dict() for f in findings]


def compute_risk_score(findings: List[SecurityFinding]) -> float:
    """Compute aggregate risk score 0–100 from findings."""
    if not findings:
        return 0.0
    weights = {"Critical": 30.0, "Medium": 15.0, "Low": 5.0}
    score = sum(weights.get(f.severity, 10.0) for f in findings)
    return min(100.0, score)
