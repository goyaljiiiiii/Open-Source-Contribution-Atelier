"""
Complexity analysis: nested-loop asymptotic hints and cyclomatic complexity.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class ComplexityFinding:
    kind: str
    name: str
    path: str
    lineno: int
    complexity: int
    asymptotic_hint: Optional[str] = None
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _python_cyclomatic(node: ast.AST) -> int:
    """McCabe cyclomatic complexity for a function/class body."""
    complexity = 1
    for child in ast.walk(node):
        if isinstance(
            child,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.ExceptHandler,
                ast.With,
                ast.AsyncWith,
                ast.Assert,
                ast.comprehension,
            ),
        ):
            complexity += 1
        elif isinstance(child, ast.BoolOp):
            complexity += len(child.values) - 1
    return complexity


def _python_loop_depth(node: ast.AST, depth: int = 0) -> int:
    max_depth = depth
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.For, ast.AsyncFor, ast.While)):
            max_depth = max(max_depth, _python_loop_depth(child, depth + 1))
        else:
            max_depth = max(max_depth, _python_loop_depth(child, depth))
    return max_depth


def _asymptotic_hint(loop_depth: int) -> Optional[str]:
    if loop_depth >= 3:
        return "O(n^3)"
    if loop_depth == 2:
        return "O(n^2)"
    if loop_depth == 1:
        return "O(n)"
    return None


def analyze_python_complexity(path: str, content: str) -> List[ComplexityFinding]:
    findings: List[ComplexityFinding] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return findings

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            cc = _python_cyclomatic(node)
            loop_depth = _python_loop_depth(node)
            hint = _asymptotic_hint(loop_depth)
            if cc > 10 or (hint and hint != "O(n)"):
                findings.append(
                    ComplexityFinding(
                        kind="cyclomatic",
                        name=node.name,
                        path=path,
                        lineno=node.lineno,
                        complexity=cc,
                        asymptotic_hint=hint,
                        message=(
                            f"Function '{node.name}' cyclomatic complexity {cc}"
                            + (f", nested loops suggest {hint}" if hint and hint != "O(n)" else "")
                        ),
                    )
                )
    return findings


def _js_nested_loops(path: str, content: str) -> List[ComplexityFinding]:
    findings: List[ComplexityFinding] = []
    lines = content.splitlines()
    loop_stack = 0
    max_depth = 0
    loop_line = 1

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if re.search(r"\b(for|while)\s*\(", stripped):
            loop_stack += 1
            if loop_stack == 1:
                loop_line = i
            max_depth = max(max_depth, loop_stack)
        if stripped == "}" and loop_stack > 0:
            loop_stack -= 1

    hint = _asymptotic_hint(max_depth)
    if hint and hint != "O(n)":
        findings.append(
            ComplexityFinding(
                kind="nested_loops",
                name="(file scope)",
                path=path,
                lineno=loop_line,
                complexity=max_depth,
                asymptotic_hint=hint,
                message=f"Nested loops suggest {hint} behaviour",
            )
        )
    return findings


def analyze_complexity(path: str, content: str) -> List[ComplexityFinding]:
    """Analyse complexity for a single source file."""
    if path.lower().endswith(".py"):
        return analyze_python_complexity(path, content)
    if path.lower().endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
        return _js_nested_loops(path, content)
    return []


def complexity_to_dicts(findings: List[ComplexityFinding]) -> List[Dict[str, Any]]:
    return [f.to_dict() for f in findings]
