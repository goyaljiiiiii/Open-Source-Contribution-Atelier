"""
Big-O complexity challenge lesson plugin.

Empirically measures a submitted function's runtime growth across
increasing input sizes and fits it against candidate complexity classes
(O(1), O(log n), O(n), O(n log n), O(n^2)), then checks whether the
best-fit class matches the expected complexity for the exercise.

IMPORTANT: execution of submitted code MUST reuse the existing sandboxed
execution mechanism from PythonSandboxPlugin in lesson_plugins.py (see
UnitTestChallengePlugin, issue #30, for the same requirement) — not a
second independent exec()-based path. `_run_timed_in_sandbox` below is a
placeholder that must be wired to that real internal method.
"""

import math
from typing import Any, Callable, Dict, List, Tuple

from .plugins import LessonPlugin, registry

# TODO(implementer): import the real sandbox execution entrypoint from
# lesson_plugins.py once its actual method signature is confirmed, e.g.:
#   from .lesson_plugins import PythonSandboxPlugin
# and call whatever internal method it uses to run code AND return timing,
# instead of the placeholder below. If the existing sandbox mechanism
# doesn't currently support returning execution wall-clock time, that's a
# small addition needed there too — flag for discussion with whoever owns
# that file rather than duplicating a separate timing-capable execution path.

_INPUT_SIZES = (100, 500, 1000, 2000, 4000, 8000)


def _run_timed_in_sandbox(function_code: str, function_name: str, input_size: int) -> float:
    """
    Placeholder for the real sandboxed, timed execution call. MUST be
    replaced with a call into PythonSandboxPlugin's existing execution
    mechanism (extended to report wall-clock time if it doesn't already),
    per the module docstring — not implemented as a second exec() path
    here.

    Expected return: wall-clock seconds taken to run the submitted
    function against an input of the given size (input generation
    convention — e.g. a list of `input_size` random integers — should
    match whatever calling convention PythonSandboxPlugin already uses).
    """
    raise NotImplementedError(
        "Wire this to PythonSandboxPlugin's real sandbox execution method "
        "in lesson_plugins.py, extended to report timing — see module "
        "docstring. Deliberately not implemented as a second exec() path."
    )


def _candidate_growth_functions() -> Dict[str, Callable[[int], float]]:
    return {
        "O(1)": lambda n: 1.0,
        "O(log n)": lambda n: math.log2(max(n, 2)),
        "O(n)": lambda n: float(n),
        "O(n log n)": lambda n: n * math.log2(max(n, 2)),
        "O(n^2)": lambda n: float(n) ** 2,
    }


def _fit_complexity_class(sizes: List[int], timings: List[float]) -> Tuple[str, float]:
    """
    For each candidate complexity class, fit timings = a * growth(n) via
    least-squares (single-parameter linear fit through the origin, since
    Big-O classes are about growth *shape*, not the constant factor), then
    pick the class with the lowest residual sum of squares (after
    normalizing timings so classes are compared fairly regardless of
    absolute scale).

    Returns (best_fit_class_name, r_squared_of_best_fit).
    """
    if len(sizes) != len(timings) or len(sizes) < 3:
        return "insufficient_data", 0.0

    # Normalize timings to [0, 1] so absolute runtime scale doesn't bias
    # the fit toward whichever candidate function happens to have similar
    # raw magnitude to the measured times.
    max_timing = max(timings) if max(timings) > 0 else 1.0
    normalized_timings = [t / max_timing for t in timings]

    best_class = None
    best_r_squared = -1.0

    for class_name, growth_fn in _candidate_growth_functions().items():
        growth_values = [growth_fn(n) for n in sizes]
        max_growth = max(growth_values) if max(growth_values) > 0 else 1.0
        normalized_growth = [g / max_growth for g in growth_values]

        # Least-squares scale factor a minimizing sum((a*g_i - t_i)^2)
        numerator = sum(g * t for g, t in zip(normalized_growth, normalized_timings))
        denominator = sum(g * g for g in normalized_growth)
        a = numerator / denominator if denominator != 0 else 0.0

        predicted = [a * g for g in normalized_growth]
        ss_res = sum((t - p) ** 2 for t, p in zip(normalized_timings, predicted))
        mean_t = sum(normalized_timings) / len(normalized_timings)
        ss_tot = sum((t - mean_t) ** 2 for t in normalized_timings)

        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else (1.0 if ss_res == 0 else 0.0)

        if r_squared > best_r_squared:
            best_r_squared = r_squared
            best_class = class_name

    return best_class, best_r_squared


class BigOComplexityChallengePlugin(LessonPlugin):
    """
    Lesson plugin for algorithmic complexity challenges: empirically
    measures a submitted function's growth rate and checks it against
    an expected Big-O class.

    Expected submission data shape:
    {
        "function_code": "def find_max(items):\\n    ...",
        "function_name": "find_max",
        "expected_complexity": "O(n)"
    }
    """

    identifier = "bigo_complexity_challenge"
    version = "1.0"
    name = "Big-O Complexity Challenge"
    description = (
        "Implement a function meeting a target time complexity — "
        "measured empirically by running it at increasing input sizes "
        "and curve-fitting the growth rate, not by trusting a claimed "
        "complexity."
    )

    MIN_ACCEPTABLE_R_SQUARED = 0.7

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        base = super().get_metadata()
        base["supported_complexity_classes"] = list(_candidate_growth_functions().keys())
        return base

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        for key in ("function_code", "function_name", "expected_complexity"):
            if not isinstance(data.get(key), str) or not data[key].strip():
                return False

        if data["expected_complexity"] not in _candidate_growth_functions():
            return False

        return True

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        function_code = data["function_code"]
        function_name = data["function_name"]
        expected_complexity = data["expected_complexity"]

        timings = []
        try:
            for size in _INPUT_SIZES:
                elapsed = _run_timed_in_sandbox(function_code, function_name, size)
                timings.append(elapsed)
        except NotImplementedError:
            raise  # surface clearly during development
        except Exception:
            return 0.0

        best_fit_class, r_squared = _fit_complexity_class(list(_INPUT_SIZES), timings)

        if best_fit_class == "insufficient_data":
            return 0.0

        if r_squared < cls.MIN_ACCEPTABLE_R_SQUARED:
            # The measured timings don't clearly fit ANY candidate class
            # well (noisy/inconsistent measurement) — can't confidently
            # grade against the expected complexity either way.
            return 0.0

        if best_fit_class == expected_complexity:
            return 100.0

        # Partial credit: submitting something that's asymptotically
        # BETTER than required (e.g. O(log n) when O(n) was expected)
        # demonstrates real understanding even if it doesn't exactly
        # match — full marks for that case specifically.
        class_order = list(_candidate_growth_functions().keys())
        if class_order.index(best_fit_class) < class_order.index(expected_complexity):
            return 100.0

        return 0.0


registry.register(BigOComplexityChallengePlugin)
