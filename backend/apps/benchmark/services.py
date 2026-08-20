"""
Benchmark services — memory and CPU profiling utilities.

Provides a context manager that captures peak RSS and tracemalloc
snapshots so that benchmark results can report actual memory consumption
during AST-heavy verification workloads.
"""

import threading
import time
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

    RSS is sampled every 50 ms in a background thread so that the true
    peak — not just the end-of-workload value — is captured.  Tracing
    is always stopped in a ``finally`` block so that an exception in the
    profiled body does not leak tracemalloc state.

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

    peak_rss_bytes = process.memory_info().rss
    stop_event = threading.Event()

    def _sample_rss():
        nonlocal peak_rss_bytes
        while not stop_event.is_set():
            try:
                current = process.memory_info().rss
                if current > peak_rss_bytes:
                    peak_rss_bytes = current
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
            time.sleep(0.05)

    sampler = threading.Thread(target=_sample_rss, daemon=True)
    sampler.start()

    try:
        yield snapshot
    finally:
        stop_event.set()
        sampler.join(timeout=2)
        try:
            _, tracemalloc_peak = tracemalloc.get_traced_memory()
        except RuntimeError:
            tracemalloc_peak = 0
        finally:
            tracemalloc.stop()

        snapshot.peak_rss_mb = peak_rss_bytes / (1024 * 1024)
        snapshot.tracemalloc_peak_mb = tracemalloc_peak / (1024 * 1024)
