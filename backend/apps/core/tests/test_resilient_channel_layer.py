"""
Tests for ResilientChannelLayer's Redis pool release on degrade.

When the layer falls back to InMemoryChannelLayer the Redis layer becomes
unreachable through ``_active``, so its connection pools must be closed at
degrade time or the sockets are retained for the process lifetime.
"""

import asyncio

import pytest

from apps.core import resilient_channel_layer
from apps.core.resilient_channel_layer import ResilientChannelLayer


class _FailingPrimary:
    """Stands in for RedisChannelLayer: every operation fails."""

    def __init__(self):
        self.close_pools_calls = 0

    async def group_add(self, group, channel):
        raise ConnectionError("redis is down")

    async def group_send(self, group, message):
        raise ConnectionError("redis is down")

    async def close_pools(self):
        self.close_pools_calls += 1


class _RecordingFallback:
    def __init__(self):
        self.calls = []

    async def group_add(self, group, channel):
        self.calls.append(("group_add", group, channel))
        return "fallback"

    async def group_send(self, group, message):
        self.calls.append(("group_send", group, message))
        return "fallback"


def _layer(primary, fallback):
    """Build a layer without touching real Redis or Channels config."""
    layer = ResilientChannelLayer.__new__(ResilientChannelLayer)
    layer._config = {}
    layer._primary = primary
    layer._fallback = fallback
    layer._active = primary
    layer.degraded = False
    return layer


@pytest.mark.asyncio
async def test_degrade_closes_primary_pools():
    primary, fallback = _FailingPrimary(), _RecordingFallback()
    layer = _layer(primary, fallback)

    result = await layer.group_add("g", "c")

    assert result == "fallback"
    assert layer.degraded is True
    assert primary.close_pools_calls == 1, "Redis pools were not released on degrade"
    assert fallback.calls == [("group_add", "g", "c")]


@pytest.mark.asyncio
async def test_pools_closed_only_once_across_operations():
    primary, fallback = _FailingPrimary(), _RecordingFallback()
    layer = _layer(primary, fallback)

    await layer.group_add("g", "c")
    await layer.group_send("g", {"type": "x"})

    # Second call already runs against the fallback, so no further cleanup.
    assert primary.close_pools_calls == 1


@pytest.mark.asyncio
async def test_close_pools_failure_does_not_break_fallback():
    class _BadCloser(_FailingPrimary):
        async def close_pools(self):
            # Record before raising, so the assertion below cannot pass
            # vacuously if cleanup is never attempted at all.
            self.close_pools_calls += 1
            raise RuntimeError("cleanup exploded")

    primary = _BadCloser()
    layer = _layer(primary, _RecordingFallback())

    assert await layer.group_add("g", "c") == "fallback"
    assert primary.close_pools_calls == 1, "cleanup was never attempted"
    assert layer.degraded is True


@pytest.mark.asyncio
async def test_synchronous_close_pools_is_supported():
    """A non-awaitable close_pools() must still run and not be awaited."""

    class _SyncCloser(_FailingPrimary):
        def close_pools(self):
            self.close_pools_calls += 1

    primary = _SyncCloser()
    layer = _layer(primary, _RecordingFallback())

    assert await layer.group_add("g", "c") == "fallback"
    assert primary.close_pools_calls == 1


@pytest.mark.asyncio
async def test_hung_close_pools_does_not_stall_fallback(monkeypatch):
    """Cleanup is bounded: a wedged Redis close must not delay degradation."""

    class _HangingCloser(_FailingPrimary):
        async def close_pools(self):
            self.close_pools_calls += 1
            await asyncio.sleep(3600)

    monkeypatch.setattr(resilient_channel_layer, "CLOSE_POOLS_TIMEOUT", 0.01)
    primary = _HangingCloser()
    layer = _layer(primary, _RecordingFallback())

    result = await asyncio.wait_for(layer.group_add("g", "c"), timeout=5)

    assert result == "fallback"
    assert primary.close_pools_calls == 1
    assert layer.degraded is True


@pytest.mark.asyncio
async def test_primary_without_close_pools_is_tolerated():
    class _NoCloser:
        async def group_add(self, group, channel):
            raise ConnectionError("redis is down")

    layer = _layer(_NoCloser(), _RecordingFallback())

    assert await layer.group_add("g", "c") == "fallback"
    assert layer.degraded is True
