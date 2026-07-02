"""
Redis-based distributed locking for horizontal scaling.
"""

import redis
from contextlib import contextmanager
import time
import uuid
import logging

logger = logging.getLogger(__name__)


class DistributedLock:
    """
    Redis-based distributed lock for coordinating badge evaluation
    across multiple server instances.
    """
    
    def __init__(self, redis_client, lock_key, timeout=10):
        """
        Initialize a distributed lock.
        
        Args:
            redis_client: Redis client instance
            lock_key: Unique key for the lock
            timeout: Lock expiration in seconds (prevents deadlocks)
        """
        self.redis = redis_client
        self.lock_key = f"lock:{lock_key}"
        self.timeout = timeout
        self.lock_value = str(uuid.uuid4())
        self.acquired = False
    
    @contextmanager
    def acquire(self, retry_count=5, retry_delay=0.1):
        """
        Acquire distributed lock with retry.
        
        Args:
            retry_count: Number of retry attempts
            retry_delay: Initial delay between retries (exponential backoff)
        
        Yields:
            None when lock is acquired
        
        Raises:
            Exception: If lock cannot be acquired after all retries
        """
        for attempt in range(retry_count):
            if self._try_acquire():
                try:
                    logger.debug(f"Lock acquired: {self.lock_key}")
                    yield
                    return
                finally:
                    self._release()
            
            # Exponential backoff
            delay = retry_delay * (2 ** attempt) + (attempt * 0.01)
            logger.warning(
                f"Lock {self.lock_key} not acquired, attempt {attempt + 1}/{retry_count}, "
                f"waiting {delay:.3f}s"
            )
            time.sleep(delay)
        
        raise Exception(
            f"Could not acquire lock {self.lock_key} after {retry_count} attempts"
        )
    
    def _try_acquire(self):
        """
        Try to acquire lock using SET NX (only set if not exists).
        
        Returns:
            bool: True if lock was acquired, False otherwise
        """
        acquired = self.redis.set(
            self.lock_key,
            self.lock_value,
            nx=True,  # Only set if key doesn't exist
            ex=self.timeout  # Expire after timeout seconds
        )
        if acquired:
            self.acquired = True
        return acquired
    
    def _release(self):
        """
        Release lock only if we own it.
        
        Uses Lua script for atomic check-and-delete.
        """
        if not self.acquired:
            return
        
        # Lua script to atomically verify ownership and delete
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        
        result = self.redis.eval(script, 1, self.lock_key, self.lock_value)
        
        if result:
            logger.debug(f"Lock released: {self.lock_key}")
        else:
            logger.warning(
                f"Could not release lock {self.lock_key} - lock may have expired"
            )
        
        self.acquired = False


def create_redis_client(redis_url=None):
    """
    Create a Redis client instance.
    
    Args:
        redis_url: Redis connection URL (optional)
    
    Returns:
        redis.Redis: Redis client
    """
    if redis_url:
        return redis.from_url(redis_url)
    
    # Default local Redis
    return redis.Redis(
        host='localhost',
        port=6379,
        db=0,
        decode_responses=True
    )