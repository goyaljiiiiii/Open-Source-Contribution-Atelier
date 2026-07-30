import logging
import time
import uuid
from typing import Optional

from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle

logger = logging.getLogger(__name__)


def get_redis_connection():
    try:
        from django_redis import get_redis_connection as get_redis  # type: ignore

        return get_redis("default")
    except (ImportError, NotImplementedError):
        return None


class SlidingWindowThrottle(SimpleRateThrottle):
    """
    Rate throttle using sliding window algorithm via Redis sorted sets.
    """

    num_requests: Optional[int] = None
    duration: Optional[int] = None
    oldest_score: float = 0.0

    def allow_request(self, request, view):
        """
        Implement sliding window rate limiting.
        """
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        self.history = []

        redis_client = get_redis_connection()
        if not redis_client:
            return super().allow_request(request, view)

        self.now = time.time()
        duration = self.duration if self.duration is not None else 60
        num_requests = self.num_requests if self.num_requests is not None else 100

        cutoff = self.now - duration
        member_id = f"{self.now}:{uuid.uuid4().hex}"

        try:
            pipeline = redis_client.pipeline()
            pipeline.zremrangebyscore(self.key, 0, cutoff)
            pipeline.zadd(self.key, {member_id: self.now})
            pipeline.zcard(self.key)
            pipeline.expire(self.key, duration)
            results = pipeline.execute()

            count = results[2]

            if count > num_requests:
                redis_client.zrem(self.key, member_id)
                oldest = redis_client.zrange(self.key, 0, 0, withscores=True)
                if oldest:
                    self.oldest_score = oldest[0][1]
                else:
                    self.oldest_score = self.now
                return False

            return True
        except Exception as e:
            logger.error(f"Redis rate limiting failed: {e}")
            return super().allow_request(request, view)

    def wait(self):
        """
        Returns the recommended number of seconds to wait before the next request.
        """
        duration = self.duration if self.duration is not None else 60
        if hasattr(self, "oldest_score"):
            oldest_score = getattr(self, "oldest_score", self.now) or self.now
            wait_time = duration - (self.now - oldest_score)
            return max(1, int(wait_time))
        return super().wait()


class SlidingWindowAnonThrottle(SlidingWindowThrottle):
    scope = "anon"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class SlidingWindowUserThrottle(SlidingWindowThrottle):
    scope = "user"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = getattr(request.user, "pk", getattr(request.user, "id", None))
        else:
            ident = self.get_ident(request)

        return self.cache_format % {"scope": self.scope, "ident": ident}


class SlidingWindowScopedThrottle(SlidingWindowThrottle):
    scope_attr = "throttle_scope"

    def allow_request(self, request, view):
        self.scope = getattr(view, self.scope_attr, None)
        if not self.scope:
            return True

        self.rate = self.get_rate()
        if not self.rate:
            return True

        num_requests, duration = self.parse_rate(self.rate)
        self.num_requests = num_requests
        self.duration = duration

        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = getattr(request.user, "pk", getattr(request.user, "id", None))
        else:
            ident = self.get_ident(request)

        return self.cache_format % {"scope": self.scope, "ident": ident}