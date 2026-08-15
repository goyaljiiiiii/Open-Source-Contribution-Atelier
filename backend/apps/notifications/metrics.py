"""
Prometheus metrics for the notifications app.

Mirrors the optional-dependency pattern used in
``apps.sandbox.services.execution_tracker``: if ``prometheus_client`` is not
installed the gauge is ``None`` and every helper degrades to a no-op, so
importing this module can never break a consumer.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

GAUGE_NAME = "notifications_ws_active_connections"

try:
    from prometheus_client import REGISTRY, Gauge

    WS_ACTIVE_CONNECTIONS = Gauge(
        GAUGE_NAME,
        "Number of live notification WebSocket connections held by this process",
    )
except ImportError:
    WS_ACTIVE_CONNECTIONS = None
except ValueError:
    # Duplicate registration — the module was imported twice under different
    # names (common under autoreload / importlib test collection).
    WS_ACTIVE_CONNECTIONS = None
    logger.debug("notifications_ws_active_connections already registered")


def ws_connection_opened() -> None:
    """Record that an authenticated WebSocket connection was accepted."""
    if WS_ACTIVE_CONNECTIONS is not None:
        WS_ACTIVE_CONNECTIONS.inc()


def ws_connection_closed() -> None:
    """Record that a previously counted WebSocket connection went away."""
    if WS_ACTIVE_CONNECTIONS is not None:
        WS_ACTIVE_CONNECTIONS.dec()


def ws_active_connections() -> float | None:
    """
    Current gauge value, or ``None`` when prometheus_client is unavailable.

    Used by the leak tests to assert the count returns to baseline. Reads
    through the registry's public sampling API rather than the gauge's private
    ``_value``, so this keeps working if prometheus_client changes internals.
    """
    if WS_ACTIVE_CONNECTIONS is None:
        return None
    return REGISTRY.get_sample_value(GAUGE_NAME)
