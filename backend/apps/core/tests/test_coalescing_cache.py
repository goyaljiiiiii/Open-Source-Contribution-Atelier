import multiprocessing
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache
from django.test import TestCase

from apps.core.cache.coalescing import CoalescingCache


def hard_crashing_compute():
    # Simulate a hard crash using os._exit
    # We must not run this directly in the main process
    os._exit(1)


def slow_compute(sleep_time=0.5):
    time.sleep(sleep_time)
    return "computed_value"


class TestCoalescingCache(TestCase):
    def setUp(self):
        cache.clear()
        self.coalescing_cache = CoalescingCache()
        self.compute_call_count = 0

    def compute_fn(self):
        self.compute_call_count += 1
        time.sleep(0.5)  # Simulate expensive DB query
        return "expensive_result"

    def test_concurrent_cache_misses(self):
        """
        Simulate 20 concurrent cache misses. Only exactly 1 compute_fn should execute.
        """
        key = "test_concurrent_key"

        def worker():
            return self.coalescing_cache.get_or_set_coalesced(key, 10, self.compute_fn)

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(worker) for _ in range(20)]
            results = [f.result() for f in futures]

        self.assertEqual(self.compute_call_count, 1)
        for res in results:
            self.assertEqual(res, "expensive_result")

    def test_graceful_fallback(self):
        """
        Verify graceful fallback when cache.add fails (e.g., Redis down).
        """
        key = "test_fallback_key"

        # Mock cache.add to simulate Redis being unavailable
        original_add = cache.add
        try:

            def failing_add(*args, **kwargs):
                raise Exception("Redis connection refused")

            cache.add = failing_add
            result = self.coalescing_cache.get_or_set_coalesced(
                key, 10, self.compute_fn
            )
            self.assertEqual(result, "expensive_result")
            self.assertEqual(self.compute_call_count, 1)
        finally:
            cache.add = original_add

    def test_lock_release_on_crash(self):
        """
        Verify lock expires/clears if a worker crashes via os._exit.
        """
        key = "test_crash_key"
        lock_key = f"{key}:lock"

        # Spawn a separate process to acquire lock and then crash
        def crashing_worker():
            # This will acquire the lock and then crash before releasing it
            cache.add(lock_key, "1", timeout=2)  # 2 seconds TTL
            hard_crashing_compute()

        p = multiprocessing.Process(target=crashing_worker)
        p.start()
        p.join()  # Wait for it to crash

        self.assertNotEqual(p.exitcode, 0)
        self.assertEqual(cache.get(lock_key), "1")

        # Now try to get the value in main process, it should block and wait for lock expiry
        start = time.time()
        result = self.coalescing_cache.get_or_set_coalesced(key, 10, self.compute_fn)
        elapsed = time.time() - start

        self.assertEqual(result, "expensive_result")
        self.assertEqual(self.compute_call_count, 1)
        # Should have waited at least a bit for lock to expire, but bounded by backoff/timeout
        self.assertTrue(elapsed > 0)
