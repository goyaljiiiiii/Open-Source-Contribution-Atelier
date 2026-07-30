import logging

from django.conf import settings

from apps.accounts.throttles import RedisLuaRateLimiter  # type: ignore

logger = logging.getLogger(__name__)


class WebSocketRateLimitMiddleware:
    """
    Channels ASGI middleware that enforces a per-session (or per-IP) message quota
    on WebSocket connections using Redis Lua scripting or local fallback.
    """

    def __init__(self, inner):
        self.inner = inner
        self.quota = getattr(settings, "WS_MESSAGE_QUOTA", 60)
        self.window = getattr(settings, "WS_QUOTA_WINDOW", 60)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            return await self.inner(scope, receive, send)

        user = scope.get("user")
        if user and user.is_authenticated:
            ident = f"user:{getattr(user, 'pk', getattr(user, 'id', ''))}"
        elif "session" in scope and scope["session"].session_key:
            ident = f"session:{scope['session'].session_key}"
        else:
            client = scope.get("client")
            ip = client[0] if client else "unknown"
            ident = f"ip:{ip}"

        cache_key = f"ws_ratelimit:{ident}"

        async def rate_limited_receive():
            message = await receive()
            if message.get("type") == "websocket.receive":
                backend = getattr(settings, "RATE_LIMIT_BACKEND", "local").lower()
                allowed = True

                if backend == "redis":
                    try:
                        limiter = RedisLuaRateLimiter(
                            key=cache_key,
                            max_requests=self.quota,
                            window_seconds=self.window,
                        )
                        allowed, _, _ = limiter.check()
                    except Exception as e:
                        logger.warning(
                            f"WebSocket Redis Lua throttling failed ({e}); allowing frame."
                        )
                else:
                    from django.core.cache import cache

                    current = cache.get(cache_key, 0)
                    if current >= self.quota:
                        allowed = False
                    elif current == 0:
                        cache.set(cache_key, 1, self.window)
                    else:
                        try:
                            cache.incr(cache_key)
                        except ValueError:
                            cache.set(cache_key, current + 1, self.window)

                if not allowed:
                    logger.warning(
                        f"WebSocket rate limit exceeded for key '{cache_key}'"
                    )
                    await send(
                        {
                            "type": "websocket.send",
                            "text": '{"error": "Rate limit exceeded", "code": 4429}',
                        }
                    )
                    return {"type": "websocket.receive", "text": ""}

            return message

        return await self.inner(scope, rate_limited_receive, send)