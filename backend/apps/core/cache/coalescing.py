import logging
import time

from django.core.cache import cache

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter

    COALESCING_CACHE_CONTENTION_COUNT = Counter(
        "coalescing_cache_contention_count",
        "Number of times a request blocks on a coalescing cache lock",
    )
except ImportError:
    COALESCING_CACHE_CONTENTION_COUNT = None


class CoalescingCache:
    def get_or_set_coalesced(self, key, timeout, compute_fn):
        """
        Check cache for the key. If absent, acquire a distributed lock.
        The lock holder computes the value. Others block until value appears.
        """
        value = cache.get(key)
        if value is not None:
            return value

        lock_key = f"{key}:lock"

        try:
            # cache.add is equivalent to SET NX in most Django backends (including Redis)
            acquired = cache.add(lock_key, "1", timeout=5)
        except Exception as e:
            logger.warning(
                f"Coalescing cache lock failure: {e}. Falling back to compute."
            )
            value = compute_fn()
            cache.set(key, value, timeout)
            return value

        if acquired:
            try:
                value = compute_fn()
                cache.set(key, value, timeout)
                return value
            finally:
                cache.delete(lock_key)
        else:
            if COALESCING_CACHE_CONTENTION_COUNT is not None:
                COALESCING_CACHE_CONTENTION_COUNT.inc()

            # Poll with exponential backoff (max 5s)
            start_time = time.time()
            wait_time = 0.05
            while time.time() - start_time < 5.0:
                value = cache.get(key)
                if value is not None:
                    return value

                time.sleep(wait_time)
                # Exponential backoff up to 0.5s max sleep
                wait_time = min(wait_time * 2, 0.5)

            logger.warning(
                f"Coalescing cache timeout waiting for key: {key}. Falling back to compute."
            )
            value = compute_fn()
            cache.set(key, value, timeout)
            return value
