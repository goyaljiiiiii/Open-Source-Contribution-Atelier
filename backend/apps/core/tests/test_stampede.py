import threading
import time

from django.core.cache import cache
from django.test import TestCase
from hypothesis import given, settings
from hypothesis import strategies as st

from apps.core.cache.stampede import stampede_protected_get_or_set


class TestCacheStampede(TestCase):
    def setUp(self):
        cache.clear()

    @settings(deadline=None, max_examples=10)
    @given(st.integers(min_value=10, max_value=100))
    def test_concurrent_requests_do_not_stampede(self, num_requests):
        cache.clear()
        call_count = 0

        def generate():
            nonlocal call_count
            call_count += 1
            # Simulate slow DB query or generation process
            time.sleep(0.05)
            return "computed_result"

        results = [None] * num_requests

        def worker(idx):
            res = stampede_protected_get_or_set(
                "hypo_test_key", generate, timeout=10, max_wait_ms=500
            )
            results[idx] = res

        threads = []
        for i in range(num_requests):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        # We expect a very small number of recomputes (ideally 1) even with 100 concurrent requests.
        self.assertLess(call_count, 5)

        # All threads should successfully receive the computed result.
        for res in results:
            self.assertEqual(res, "computed_result")

    def test_probabilistic_xfetch(self):
        # Test that XFetch correctly probabilistically decides to recompute
        # when a cache item is nearing expiration (stale data).
        
        call_count = 0
        def generate():
            nonlocal call_count
            call_count += 1
            return "fresh_data"
            
        # First call populates cache
        res = stampede_protected_get_or_set("xfetch_key", generate, timeout=2)
        self.assertEqual(res, "fresh_data")
        self.assertEqual(call_count, 1)
        
        # Immediate subsequent call should return cached data without recomputing
        res = stampede_protected_get_or_set("xfetch_key", generate, timeout=2)
        self.assertEqual(call_count, 1)
        
        # Simulate time passing so the key logically expires but is still in physical cache
        # Let's mock time.time
        import unittest.mock as mock
        
        # If we advance time beyond expiry, it should probabilistically recompute
        # Since p = beta * (now - expiry) / timeout, if now == expiry, p = 0
        # If now == expiry + timeout, p = 1
        with mock.patch('time.time') as mock_time:
            # Original time + 3s, which is 1s after logical expiration.
            # p = 1.0 * (3 - 2) / 2 = 0.5 probability
            # We force random.random to return 0.1 so it recomputes
            mock_time.return_value = time.time() + 3
            
            with mock.patch('random.random', return_value=0.1):
                res = stampede_protected_get_or_set("xfetch_key", generate, timeout=2)
                self.assertEqual(call_count, 2)
                
            # If random.random returns 0.9, it should NOT recompute (return stale data)
            with mock.patch('random.random', return_value=0.9):
                res = stampede_protected_get_or_set("xfetch_key", generate, timeout=2)
                self.assertEqual(call_count, 2)
