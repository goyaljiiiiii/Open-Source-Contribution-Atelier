"""
Benchmark services — memory and CPU profiling utilities.

Provides a context manager that captures peak RSS and tracemalloc
snapshots so that benchmark results can report actual memory consumption
during AST-heavy verification workloads.
"""

import tracemalloc
from contextlib import contextmanager
from dataclasses import dataclass

import psutil


@dataclass
class MemorySnapshot:
    """Peak memory measurements captured during a benchmark run."""

    peak_rss_mb: float
    tracemalloc_peak_mb: float


@contextmanager
def memory_profiler():
    """Context manager that records peak RSS and tracemalloc peak usage.

    Yields a ``MemorySnapshot`` whose values are *final* after the
    context exits.

    Usage::

        with memory_profiler() as profiler:
            run_benchmark()
        print(profiler.peak_rss_mb)
    """
    process = psutil.Process()
    tracemalloc.start()
    snapshot = MemorySnapshot(peak_rss_mb=0.0, tracemalloc_peak_mb=0.0)

    yield snapshot

    current_rss = process.memory_info().rss / (1024 * 1024)
    _, tracemalloc_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    snapshot.peak_rss_mb = current_rss
    snapshot.tracemalloc_peak_mb = tracemalloc_peak / (1024 * 1024)
