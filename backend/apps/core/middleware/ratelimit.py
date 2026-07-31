import logging
import time

import redis
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from apps.core.throttling import is_premium_user

logger = logging.getLogger(__name__)


LUA_RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

local current = redis.call("INCR", key)
if current == 1 then
    redis.call("EXPIRE", key, window)
end

local ttl = redis.call("TTL", key)
if current > limit then
    return {0, current, ttl}
else
    return {1, current, ttl}
end
"""

_LUA_SHA = None


def get_redis_client():
    try:
        redis_url = getattr(settings, "REDIS_URL", None) or getattr(
            settings, "RATE_LIMIT_REDIS_URL", None
        )

        if redis_url:
            return redis.from_url(
                redis_url,
                socket_connect_timeout=0.2,
                socket_timeout=0.2,
                decode_responses=True,
            )
    except Exception as e:
        logger.warning("Caught exception: %s", e)
    return None


def _parse_rate_to_int(rate_setting, default_val: int) -> int:
    """Helper to parse rates like '100/hour' or integer 100 into integer request limit."""
    if isinstance(rate_setting, int):
        return rate_setting
    if isinstance(rate_setting, str):
        try:
            return int(rate_setting.split("/")[0])
        except Exception:
            pass
    return default_val


class RateLimitMiddleware(MiddlewareMixin):
    """
    Distributed rate limiting middleware supporting configurable tiers:
    - Anonymous: 100 req/hr
    - Authenticated: 1000 req/hr
    - Premium: 10000 req/hr
    Sets standard X-RateLimit-* and Retry-After headers on responses.
    """

    def __init__(self, get_response):
        super().__init__(get_response)
        self.anon_limit = _parse_rate_to_int(getattr(settings, "API_RATE_LIMIT_ANON", 100), 100)
        self.auth_limit = _parse_rate_to_int(getattr(settings, "API_RATE_LIMIT_AUTH", 1000), 1000)
        self.premium_limit = _parse_rate_to_int(getattr(settings, "API_RATE_LIMIT_PREMIUM", 10000), 10000)
        self.window = getattr(settings, "API_RATE_LIMIT_WINDOW", 3600)
        self.redis_client = get_redis_client()

    def process_request(self, request):
        if getattr(settings, "DISABLE_RATE_LIMITING", False):
            return None

        if not request.path.startswith("/api/"):
            return None

        if request.path.startswith("/api/webhooks/"):
            return None

        if request.path.startswith(("/admin/", "/static/", "/health/", "/media/")):
            return None

        is_auth = hasattr(request, "user") and request.user.is_authenticated

        if is_auth:
            if is_premium_user(request.user):
                limit = self.premium_limit
                identifier = f"user:premium:{request.user.id}"
            else:
                limit = self.auth_limit
                identifier = f"user:{request.user.id}"
        else:
            limit = self.anon_limit
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                ip = x_forwarded_for.split(",")[0].strip()
            else:
                ip = request.META.get("REMOTE_ADDR")
            identifier = f"ip:{ip}"

        cache_key = f"ratelimit:{identifier}"

        allowed, remaining, ttl = self._check_rate_limit(cache_key, limit, self.window)
        reset_val = ttl if (ttl is not None and ttl > 0) else self.window

        request._rate_limit_info = {
            "limit": limit,
            "remaining": remaining,
            "reset": reset_val,
        }

        if not allowed:
            response = JsonResponse(
                {
                    "error": "rate_limited",
                    "code": "rate_limited",
                    "message": "Request limit exceeded. Please wait before retrying.",
                    "retry_after": reset_val,
                },
                status=429,
            )
            response["Retry-After"] = str(reset_val)
            response["X-RateLimit-Limit"] = str(limit)
            response["X-RateLimit-Remaining"] = "0"
            response["X-RateLimit-Reset"] = str(int(time.time() + reset_val))
            return response

        return None

    def process_response(self, request, response):
        if hasattr(request, "_rate_limit_info"):
            info = request._rate_limit_info
            reset_secs = info.get("reset") or self.window
            response["X-RateLimit-Limit"] = str(info["limit"])
            response["X-RateLimit-Remaining"] = str(info["remaining"])
            response["X-RateLimit-Reset"] = str(int(time.time() + reset_secs))

        return response

    def _check_rate_limit(self, key, limit, window):
        backend = getattr(settings, "RATE_LIMIT_BACKEND", "local").lower()

        if backend == "redis" and self.redis_client:
            global _LUA_SHA
            try:
                if _LUA_SHA is None:
                    _LUA_SHA = self.redis_client.script_load(LUA_RATE_LIMIT_SCRIPT)

                try:
                    res = self.redis_client.evalsha(_LUA_SHA, 1, key, window, limit)
                except Exception:
                    _LUA_SHA = self.redis_client.script_load(LUA_RATE_LIMIT_SCRIPT)
                    res = self.redis_client.evalsha(_LUA_SHA, 1, key, window, limit)

                allowed = bool(res[0])
                current_count = int(res[1])
                ttl = int(res[2]) if res[2] and res[2] > 0 else window
                remaining = max(0, limit - current_count) if allowed else 0

                return allowed, remaining, ttl
            except Exception as e:
                logger.warning(
                    f"Rate limit redis lua error, falling back to local/cache: {e}"
                )

        # Fallback to local fixed-window via Django cache
        try:
            current = cache.get(key, 0)
            if current >= limit:
                return False, 0, window

            if current == 0:
                cache.set(key, 1, window)
                return True, limit - 1, window
            else:
                try:
                    current = cache.incr(key)
                except ValueError:
                    current = current + 1
                    cache.set(key, current, window)
                return True, max(0, limit - current), window
        except Exception as e:
            logger.error(f"Rate limiter failed open: {e}")
            return True, limit, window
