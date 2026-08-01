import time
from typing import Any, Dict, Tuple


class SandboxExecutor:
    """
    Unified sandboxing service to provide a restricted execution environment
    for backend validation of untrusted Python code.
    """

    @staticmethod
    def _get_safe_globals() -> Dict[str, Any]:
        return {
            "__builtins__": {
                "abs": abs,
                "all": all,
                "any": any,
                "bool": bool,
                "dict": dict,
                "enumerate": enumerate,
                "filter": filter,
                "float": float,
                "int": int,
                "len": len,
                "list": list,
                "map": map,
                "max": max,
                "min": min,
                "pow": pow,
                "range": range,
                "round": round,
                "set": set,
                "str": str,
                "sum": sum,
                "tuple": tuple,
                "zip": zip,
                "AssertionError": AssertionError,
                "Exception": Exception,
                "ValueError": ValueError,
                "TypeError": TypeError,
            }
        }

    @classmethod
    def execute(cls, code: str, safe_globals: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Executes untrusted code in a restricted globals environment.
        Returns a dict with 'passed' boolean and 'error' string (if any).
        """
        env = safe_globals if safe_globals is not None else cls._get_safe_globals()
        try:
            exec(code, env)
            return {"passed": True, "error": None}
        except Exception as e:
            return {"passed": False, "error": str(e)}

    @classmethod
    def execute_timed(
        cls, code: str, safe_globals: Dict[str, Any] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Executes untrusted code and returns the wall-clock time in seconds,
        along with the regular execution result.
        """
        env = safe_globals if safe_globals is not None else cls._get_safe_globals()
        start = time.time()
        result = cls.execute(code, env)
        end = time.time()
        return (end - start), result
