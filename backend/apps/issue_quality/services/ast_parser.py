"""
AST parser for Python and JS/TS source files.

Yields node summaries: type, name, lineno.
"""

from __future__ import annotations

import ast
import logging
import re
from dataclasses import dataclass
from typing import Iterator, List, Optional

logger = logging.getLogger(__name__)

try:
    import tree_sitter  # type: ignore
    import tree_sitter_javascript  # type: ignore

    _HAS_TREE_SITTER = True
except (ImportError, ModuleNotFoundError):
    _HAS_TREE_SITTER = False


@dataclass
class AstNodeSummary:
    type: str
    name: str
    lineno: int


def _python_nodes(source: str) -> List[AstNodeSummary]:
    nodes: List[AstNodeSummary] = []
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        logger.debug("Python parse error: %s", exc)
        return nodes

    for node in ast.walk(tree):
        name = ""
        if isinstance(node, ast.FunctionDef):
            name = node.name
            ntype = "function"
        elif isinstance(node, ast.AsyncFunctionDef):
            name = node.name
            ntype = "async_function"
        elif isinstance(node, ast.ClassDef):
            name = node.name
            ntype = "class"
        elif isinstance(node, ast.Import):
            name = ", ".join(alias.name for alias in node.names)
            ntype = "import"
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            names = ", ".join(alias.name for alias in node.names)
            name = f"{module}: {names}" if module else names
            ntype = "import_from"
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            else:
                name = "call"
            ntype = "call"
        elif isinstance(node, (ast.For, ast.AsyncFor)):
            name = "for"
            ntype = "loop"
        elif isinstance(node, ast.While):
            name = "while"
            ntype = "loop"
        else:
            continue

        lineno = getattr(node, "lineno", 1)
        nodes.append(AstNodeSummary(type=ntype, name=name, lineno=lineno))

    return nodes


def _js_regex_nodes(source: str) -> List[AstNodeSummary]:
    """Heuristic tokenizer fallback for JS/TS when tree-sitter is unavailable."""
    nodes: List[AstNodeSummary] = []
    patterns = [
        (r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", "function"),
        (r"^\s*(?:export\s+)?class\s+(\w+)", "class"),
        (r"^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(", "arrow_function"),
        (r"^\s*(?:const|let|var)\s+(\w+)\s*=\s*function", "function"),
        (r"^\s*(\w+)\s*\([^)]*\)\s*\{", "method"),
        (r"\b(eval|exec)\s*\(", "call"),
        (r"\b(for|while)\s*\(", "loop"),
    ]

    for i, line in enumerate(source.splitlines(), start=1):
        for pattern, ntype in patterns:
            match = re.search(pattern, line)
            if match:
                name = match.group(1) if match.lastindex else ntype
                nodes.append(AstNodeSummary(type=ntype, name=name, lineno=i))
                break

    return nodes


def _js_tree_sitter_nodes(source: str) -> Optional[List[AstNodeSummary]]:
    if not _HAS_TREE_SITTER:
        return None
    try:
        lang = tree_sitter.Language(tree_sitter_javascript.language())
        parser = tree_sitter.Parser(lang)
        tree = parser.parse(source.encode("utf-8"))
        nodes: List[AstNodeSummary] = []

        def walk(node: tree_sitter.Node) -> None:
            ntype = node.type
            name = ""
            if ntype in ("function_declaration", "method_definition", "class_declaration"):
                for child in node.children:
                    if child.type == "identifier":
                        name = source[child.start_byte : child.end_byte]
                        break
            if ntype in (
                "function_declaration",
                "method_definition",
                "class_declaration",
                "for_statement",
                "while_statement",
                "call_expression",
            ):
                lineno = node.start_point[0] + 1
                nodes.append(
                    AstNodeSummary(
                        type=ntype.replace("_declaration", "").replace("_statement", ""),
                        name=name or ntype,
                        lineno=lineno,
                    )
                )
            for child in node.children:
                walk(child)

        walk(tree.root_node)
        return nodes
    except Exception as exc:
        logger.debug("tree-sitter parse failed: %s", exc)
        return None


def parse_source(path: str, content: str) -> List[AstNodeSummary]:
    """Parse a source file and return AST node summaries."""
    lower = path.lower()
    if lower.endswith(".py"):
        return _python_nodes(content)
    if lower.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
        ts_nodes = _js_tree_sitter_nodes(content)
        if ts_nodes is not None:
            return ts_nodes
        return _js_regex_nodes(content)
    return _js_regex_nodes(content)


def iter_nodes(path: str, content: str) -> Iterator[AstNodeSummary]:
    """Yield node summaries for a file."""
    for node in parse_source(path, content):
        yield node
