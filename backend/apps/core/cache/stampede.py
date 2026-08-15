import logging
import random
import time

from django.core.cache import cache
from prometheus_client import Histogram

logger = logging.getLogger(__name__)

cache_stampede_wait_seconds = Histogram(
    'cache_stampede_wait_seconds',
    'Time spent waiting for cache stampede recompute lock'
)

def stampede_protected_get_or_set(key, generate_func, timeout=300, beta=1.0, max_wait_ms=200):
    """
    Probabilistic early expiration (XFetch algorithm) with mutex fallback.
    Prevents cache stampedes (thundering herd) by allowing a single request to
    recompute the cache while others wait or return stale data.
    """
    cached = cache.get(key)
    now = time.time()
    
    if cached is not None and isinstance(cached, dict) and "value" in cached and "expiry" in cached:
        value = cached["value"]
        expiry = cached["expiry"]
        
        if now < expiry:
            return value
            
        # Logically expired, but physically still in cache (stale data).
        # Calculate probability of recomputing: p = beta * (now - expiry) / TTL
        p = beta * (now - expiry) / timeout
        
        if p < 1.0 and random.random() >= p:
            # Don't recompute, just return stale value
            return value
            
        # Otherwise, proceed to recompute (acquire lock).
    
    # Mutex-based fallback using redis SET NX
    lock_key = f"{key}:lock"
    
    # Try to acquire lock with 500ms TTL
    acquired = False
    try:
        from django_redis import get_redis_connection
        redis_client = get_redis_connection("default")
        # px=500 means 500 milliseconds
        acquired = redis_client.set(lock_key, "1", nx=True, px=500)
    except Exception:
        # Fallback for non-Redis or if get_redis_connection fails
        acquired = cache.add(lock_key, "1", timeout=1)
        
    if acquired:
        try:
            value = generate_func()
            expiry = time.time() + timeout
            # Physical TTL is logical TTL + 300s grace period for stale reads
            cache.set(key, {"value": value, "expiry": expiry}, timeout=timeout + 300)
            return value
        finally:
            try:
                redis_client = get_redis_connection("default")
                redis_client.delete(lock_key)
            except Exception:
                cache.delete(lock_key)
    else:
        # Did not acquire lock, meaning another worker is currently computing the value.
        # Wait up to max_wait_ms (200ms) for the lock owner to finish.
        wait_start = time.time()
        sleep_time = 0.05  # 50ms polling interval
        max_wait = max_wait_ms / 1000.0
        
        while time.time() - wait_start < max_wait:
            time.sleep(sleep_time)
            cached_new = cache.get(key)
            if cached_new is not None and isinstance(cached_new, dict) and "value" in cached_new:
                # Only return if it's newer than our stale data (or if we had no stale data)
                if cached is None or cached_new.get("expiry", 0) > cached.get("expiry", 0):
                    wait_time = time.time() - wait_start
                    cache_stampede_wait_seconds.observe(wait_time)
                    return cached_new["value"]
                    
        # Max wait reached
        wait_time = time.time() - wait_start
        cache_stampede_wait_seconds.observe(wait_time)
        
        # Return stale data if available
        if cached is not None and isinstance(cached, dict) and "value" in cached:
            return cached["value"]
            
        # Absolute fallback: if no stale data, we MUST compute it synchronously
        # This shouldn't happen often unless the lock owner crashed.
        value = generate_func()
        expiry = time.time() + timeout
        cache.set(key, {"value": value, "expiry": expiry}, timeout=timeout + 300)
        return value
