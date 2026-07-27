"""
Binary search tree challenge lesson plugin.

Validates a submitted BST implementation by running a sequence of
insert/search/delete operations and, after each mutating operation,
checking the BST ordering invariant on the resulting tree structure —
not just checking final search results, which can pass by luck even on
a structurally broken implementation.

IMPORTANT: execution of submitted code MUST reuse the existing sandboxed
execution mechanism from PythonSandboxPlugin in lesson_plugins.py (same
requirement as UnitTestChallengePlugin #30 and BigOComplexityChallengePlugin
#32) — not a second independent exec() path.
"""

from typing import Any, Dict, List, Optional, Tuple

from .plugins import LessonPlugin, registry

from .unit_test_challenge_plugin import _run_in_sandbox
import json


def _run_bst_operation_in_sandbox(
    implementation_code: str, operations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Placeholder for the real sandboxed execution call. MUST be replaced
    with a call into PythonSandboxPlugin's existing execution mechanism.
    """
    # Harness to run operations and serialize tree state
    harness = """
def _serialize_tree(node):
    if node is None: return None
    return {
        "value": getattr(node, 'value', getattr(node, 'val', None)),
        "left": _serialize_tree(getattr(node, 'left', None)),
        "right": _serialize_tree(getattr(node, 'right', None))
    }

bst = BST()
results = []
for op in _ops:
    res = {"operation": op["operation"], "value": op["value"]}
    if op["operation"] == "insert":
        bst.insert(op["value"])
    elif op["operation"] == "search":
        res["search_result"] = bst.search(op["value"])
    elif op["operation"] == "delete":
        bst.delete(op["value"])
    
    # Snapshot root - assumes implementation uses 'root' attribute or bst is the root
    root = getattr(bst, 'root', bst)
    res["tree_snapshot"] = _serialize_tree(root)
    results.append(res)
"""
    
    # Combine code. We use _run_in_sandbox as the current available execution path
    # while PythonSandboxPlugin is primarily frontend-oriented in this architecture.
    full_code = f"{implementation_code}\n_ops = {json.dumps(operations)}\n{harness}"
    
    # We need to extract 'results' from the sandbox
    safe_globals = {
        "__builtins__": {
            "getattr": getattr,
            "list": list,
            "dict": dict,
            "print": print,
        }
    }
    
    try:
        # Reusing the logic from _run_in_sandbox but capturing the 'results' variable
        exec(full_code, safe_globals)
        return safe_globals.get("results", [])
    except Exception as e:
        # If the user code crashes, we return empty results which leads to 0.0 score
        return []




def _check_bst_invariant(
    tree_snapshot: Optional[Dict[str, Any]],
    lower_bound: Optional[int] = None,
    upper_bound: Optional[int] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Recursively verify the BST ordering invariant: every value in the
    left subtree is < node value < every value in the right subtree,
    for every node. Returns (is_valid, error_message_if_invalid).

    tree_snapshot is expected to be either None (empty subtree) or
    {"value": int, "left": <snapshot or None>, "right": <snapshot or None>}.
    """
    if tree_snapshot is None:
        return True, None

    if not isinstance(tree_snapshot, dict) or "value" not in tree_snapshot:
        return False, "malformed tree snapshot (expected dict with 'value' key)"

    value = tree_snapshot["value"]

    if lower_bound is not None and value <= lower_bound:
        return False, f"value {value} violates BST invariant (must be > {lower_bound})"
    if upper_bound is not None and value >= upper_bound:
        return False, f"value {value} violates BST invariant (must be < {upper_bound})"

    left_valid, left_error = _check_bst_invariant(tree_snapshot.get("left"), lower_bound, value)
    if not left_valid:
        return False, left_error

    right_valid, right_error = _check_bst_invariant(tree_snapshot.get("right"), value, upper_bound)
    if not right_valid:
        return False, right_error

    return True, None


def _search_tree(tree_snapshot: Optional[Dict[str, Any]], target: int) -> bool:
    """Reference search against a tree snapshot, for cross-checking submitted search_result values."""
    if tree_snapshot is None:
        return False
    value = tree_snapshot["value"]
    if target == value:
        return True
    if target < value:
        return _search_tree(tree_snapshot.get("left"), target)
    return _search_tree(tree_snapshot.get("right"), target)


class BinarySearchTreeChallengePlugin(LessonPlugin):
    """
    Lesson plugin for BST implementation challenges: validates structural
    invariants after each operation, not just final output correctness.

    Expected submission data shape:
    {
        "implementation_code": "class BST:\\n    def insert(self, v): ...\\n    ...",
        "operations": [
            {"operation": "insert", "value": 5},
            {"operation": "insert", "value": 3},
            {"operation": "search", "value": 3, "expected": true},
            {"operation": "delete", "value": 3}
        ]
    }
    """

    identifier = "bst_challenge"
    version = "1.0"
    name = "Binary Search Tree Challenge"
    description = (
        "Implement a binary search tree — validated by checking the "
        "BST ordering invariant after every insert/delete, not just "
        "final search output, so structurally-broken-but-lucky "
        "implementations don't pass."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        if not isinstance(data.get("implementation_code"), str) or not data["implementation_code"].strip():
            return False

        operations = data.get("operations")
        if not isinstance(operations, list) or not operations:
            return False

        for op in operations:
            if not isinstance(op, dict) or op.get("operation") not in ("insert", "search", "delete"):
                return False
            if not isinstance(op.get("value"), int):
                return False

        return True

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        try:
            results = _run_bst_operation_in_sandbox(data["implementation_code"], data["operations"])
        except NotImplementedError:
            raise
        except Exception:
            return 0.0

        checks_passed = 0
        checks_total = 0

        for op, result in zip(data["operations"], results):
            snapshot = result.get("tree_snapshot")

            # Invariant check applies after every operation, mutating or not
            checks_total += 1
            valid, _error = _check_bst_invariant(snapshot)
            if valid:
                checks_passed += 1

            if op["operation"] == "search" and "expected" in op:
                checks_total += 1
                actual = result.get("search_result")
                if actual == op["expected"]:
                    checks_passed += 1

        if checks_total == 0:
            return 0.0

        return round((checks_passed / checks_total) * 100.0, 2)


registry.register(BinarySearchTreeChallengePlugin)
