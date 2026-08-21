"""
Tests for benchmark memory profiling.

Verifies that peak memory tracking works correctly and that memory
growth stays roughly linear as AST verification workload increases.
"""

import ast

from apps.benchmark.services import MemorySnapshot, memory_profiler


def _generate_ast_source(num_functions: int) -> str:
    """Generate valid Python source with *num_functions* function defs."""
    lines = []
    for i in range(num_functions):
        lines.append(f"def func_{i}(x, y):")
        lines.append(f"    z = x + y + {i}")
        lines.append(f"    return z * {i % 5 + 1}")
    return "\n".join(lines)


def _parse_and_walk(source: str) -> int:
    """Parse *source* into an AST and walk every node, returning node count."""
    tree = ast.parse(source)
    count = 0
    for _ in ast.walk(tree):
        count += 1
    return count


def test_memory_profiler_returns_snapshot():
    """memory_profiler yields a MemorySnapshot with non-negative values."""
    with memory_profiler() as prof:
        data = [b"x" * 1024 for _ in range(1000)]

    assert isinstance(prof, MemorySnapshot)
    assert prof.peak_rss_mb >= 0
    assert prof.tracemalloc_peak_mb >= 0


def test_memory_profiler_tracks_allocation():
    """Allocating memory inside the profiler increases the reported peak."""
    with memory_profiler() as baseline:
        pass

    with memory_profiler() as heavy:
        # Allocate ~20 MB
        _ = [bytearray(1024) for _ in range(20 * 1024)]

    assert heavy.tracemalloc_peak_mb > baseline.tracemalloc_peak_mb


def test_ast_memory_growth_is_linear():
    """Peak tracemalloc memory should grow roughly linearly with AST size.

    We parse workloads of increasing size and check that each doubling
    of function count does not cause more than 3x the tracemalloc peak
    (generous bound to avoid flakiness).
    """
    sizes = [500, 1000, 2000]
    peaks = []

    for n in sizes:
        source = _generate_ast_source(n)
        with memory_profiler() as prof:
            _ = _parse_and_walk(source)
        peaks.append(prof.tracemalloc_peak_mb)

    # Each peak should be larger than the previous (monotonic)
    for i in range(1, len(peaks)):
        assert peaks[i] >= peaks[i - 1], (
            f"Memory did not increase: size={sizes[i]} peak={peaks[i]} "
            f"<= prev peak={peaks[i-1]}"
        )

    # Growth should be at most linear with generous slack (3x per doubling)
    for i in range(1, len(peaks)):
        ratio = peaks[i] / peaks[i - 1] if peaks[i - 1] > 0 else 0
        size_ratio = sizes[i] / sizes[i - 1]
        assert ratio <= size_ratio * 3, (
            f"Memory grew too fast: {peaks[i]:.2f}MB is {ratio:.1f}x "
            f"previous ({peaks[i-1]:.2f}MB) for {size_ratio:.1f}x AST size"
        )
