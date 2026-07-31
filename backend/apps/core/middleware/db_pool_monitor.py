import logging
import time
from typing import Any, Dict, Tuple

from django.conf import settings
from django.core.cache import cache
from django.db import connection, connections

logger = logging.getLogger(__name__)

# Prometheus metrics setup (optional dependency / safe duplicate registration handling)
try:
    from prometheus_client import Gauge

    DB_POOL_ACTIVE = Gauge("db_pool_active", "Active database connections")
    DB_POOL_IDLE = Gauge("db_pool_idle", "Idle database connections")
    DB_POOL_TOTAL = Gauge("db_pool_total", "Total database connections")
except Exception:
    DB_POOL_ACTIVE = None
    DB_POOL_IDLE = None
    DB_POOL_TOTAL = None


CACHE_KEY_HISTORY = "db_pool_metrics_history"
CACHE_KEY_LATEST = "db_pool_latest_metrics"
CACHE_KEY_CONN_MAX_AGE = "DYNAMIC_CONN_MAX_AGE"
HISTORY_RETENTION_SECONDS = 900  # 15 minutes


def get_conn_max_age() -> int:
    """Retrieve the effective CONN_MAX_AGE from cache or settings."""
    val = cache.get(CACHE_KEY_CONN_MAX_AGE)
    if val is not None:
        try:
            return int(val)
        except (ValueError, TypeError):
            pass
    return getattr(settings, "CONN_MAX_AGE", 60)


def set_conn_max_age(new_age: int) -> int:
    """Set the effective CONN_MAX_AGE in cache, bounded between 30 and 600 seconds."""
    bounded_age = max(30, min(600, int(new_age)))
    cache.set(CACHE_KEY_CONN_MAX_AGE, bounded_age, timeout=None)
    return bounded_age


def fetch_postgres_pool_stats() -> Tuple[int, int, int, int]:
    """
    Query PostgreSQL pg_stat_activity for connection pool utilization.
    Returns tuple: (active, idle, total, waiting_count)
    """
    if connection.vendor != "postgresql":
        # Fallback for non-PostgreSQL (SQLite, tests, etc.)
        mock_stats = cache.get("db_pool_mock_stats")
        if mock_stats and isinstance(mock_stats, dict):
            return (
                int(mock_stats.get("active", 1)),
                int(mock_stats.get("idle", 0)),
                int(mock_stats.get("total", 1)),
                int(mock_stats.get("waiting", 0)),
            )
        return (1, 0, 1, 0)

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COALESCE(COUNT(CASE WHEN state = 'active' THEN 1 END), 0) AS active,
                    COALESCE(COUNT(CASE WHEN state = 'idle' THEN 1 END), 0) AS idle,
                    COALESCE(COUNT(*), 0) AS total,
                    COALESCE(COUNT(CASE WHEN wait_event IS NOT NULL THEN 1 END), 0) AS waiting
                FROM pg_stat_activity
                """
            )
            row = cursor.fetchone()
            if row:
                return (int(row[0]), int(row[1]), int(row[2]), int(row[3]))
    except Exception as e:
        logger.debug("Failed to query pg_stat_activity: %s", e)

    return (1, 0, 1, 0)


def record_pool_metrics(
    active: int, idle: int, total: int, wait_time_ms: float
) -> Dict[str, Any]:
    """Record metric snapshot to Prometheus gauges and Django cache history."""
    now = time.time()
    entry = {
        "timestamp": now,
        "active": active,
        "idle": idle,
        "total": total,
        "wait_time_ms": wait_time_ms,
    }

    # Update Prometheus gauges if available
    if DB_POOL_ACTIVE is not None:
        try:
            DB_POOL_ACTIVE.set(active)
            DB_POOL_IDLE.set(idle)
            DB_POOL_TOTAL.set(total)
        except Exception:
            pass

    # Save latest entry
    cache.set(CACHE_KEY_LATEST, entry, timeout=3600)

    # Append to history list in cache
    history = cache.get(CACHE_KEY_HISTORY) or []
    cutoff = now - HISTORY_RETENTION_SECONDS
    history = [e for e in history if e.get("timestamp", 0) >= cutoff]
    history.append(entry)
    cache.set(CACHE_KEY_HISTORY, history, timeout=1800)

    return entry


class DatabasePoolMonitorMiddleware:
    """
    Middleware that records DB connection pool stats per request,
    updates Prometheus gauges, and dynamically syncs CONN_MAX_AGE.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Update CONN_MAX_AGE dynamically on active DB connections
        effective_age = get_conn_max_age()
        for conn in connections.all():
            conn.settings_dict["CONN_MAX_AGE"] = effective_age

        start_time = time.perf_counter()

        # Gather pool stats at start
        active_start, idle_start, total_start, waiting_start = fetch_postgres_pool_stats()

        response = self.get_response(request)

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # Wait time if connection was blocked (waiting > 0 or test simulated wait time)
        wait_time_ms = elapsed_ms if waiting_start > 0 else 0.0
        simulated_wait = getattr(request, "_simulated_wait_time_ms", None)
        if simulated_wait is not None:
            wait_time_ms = float(simulated_wait)

        # Record end-of-request stats snapshot
        active_end, idle_end, total_end, _ = fetch_postgres_pool_stats()
        record_pool_metrics(active_end, idle_end, total_end, wait_time_ms)

        return response
