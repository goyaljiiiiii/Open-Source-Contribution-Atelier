import asyncio

import pytest
from django.conf import settings

from apps.accounts.throttles import RedisLuaRateLimiter, UserRateThrottle


@pytest.mark.asyncio
async def test_lua_script_concurrent_rate_limiting():
    """
    Verify that under high concurrent load, the Lua script strictly enforces
    N requests in M seconds within ±5% tolerance across concurrent tasks.
    """
    key = "test_concurrent_lua_throttle"
    limit = 50
    window = 10

    from apps.accounts.throttles import get_redis_connection

    redis_client = get_redis_connection()
    if not redis_client:
        pytest.skip("Redis server is not available for Lua concurrency test.")

    redis_client.delete(key)

    async def make_request():
        limiter = RedisLuaRateLimiter(
            key=key, max_requests=limit, window_seconds=window
        )
        return await asyncio.to_thread(limiter.check)

    # Launch 100 concurrent requests (2x the limit)
    tasks = [make_request() for _ in range(100)]
    results = await asyncio.gather(*tasks)

    allowed_count = sum(1 for res in results if res[0] is True)
    denied_count = sum(1 for res in results if res[0] is False)

    # Calculate tolerance window: limit ± 5%
    min_expected = int(limit * 0.95)
    max_expected = int(limit * 1.05)

    assert (
        min_expected <= allowed_count <= max_expected
    ), f"Expected ~{limit} allowed requests (±5%), got {allowed_count}"
    assert allowed_count + denied_count == 100


def test_local_fallback_when_backend_local(settings):
    """
    Verify fallback to local cache throttling when RATE_LIMIT_BACKEND = 'local'.
    """
    settings.RATE_LIMIT_BACKEND = "local"
    throttle = UserRateThrottle()
    throttle.rate = "5/minute"
    throttle.num_requests, throttle.duration = 5, 60

    class DummyRequest:
        user = type("User", (), {"is_authenticated": True, "pk": 9999})()

    request = DummyRequest()

    # First 5 requests should pass
    for _ in range(5):
        assert throttle.allow_request(request, None) is True

    # 6th request should be denied
    assert throttle.allow_request(request, None) is False