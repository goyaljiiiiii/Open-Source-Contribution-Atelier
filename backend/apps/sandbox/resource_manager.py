import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

class ResourceManagementEngine:
    MAX_EXECUTION_TIME_SECONDS = 5
    MAX_MEMORY_MB = 128
    MAX_CPU_TIME_SECONDS = 3
    MAX_CONCURRENT_EXECUTIONS = 2

    @classmethod
    def acquire_execution_lock(cls, session_id: str) -> bool:
        """
        Ensures a session does not exceed the maximum concurrent execution limit.
        Returns True if lock acquired, False otherwise.
        """
        cache_key = f"sandbox_concurrent_executions_{session_id}"
        current = cache.get(cache_key, 0)
        
        if current >= cls.MAX_CONCURRENT_EXECUTIONS:
            logger.warning(f"Session {session_id} exceeded concurrent execution limits.")
            return False
            
        cache.set(cache_key, current + 1, timeout=cls.MAX_EXECUTION_TIME_SECONDS * 2)
        return True

    @classmethod
    def release_execution_lock(cls, session_id: str):
        """
        Decrements the concurrent execution counter for the session.
        """
        cache_key = f"sandbox_concurrent_executions_{session_id}"
        current = cache.get(cache_key, 0)
        
        if current > 0:
            cache.set(cache_key, current - 1, timeout=cls.MAX_EXECUTION_TIME_SECONDS * 2)

    @classmethod
    def get_wrapper_script(cls, code: str) -> str:
        """
        Returns a Python script string that attempts to set resource limits using the
        Unix 'resource' module before executing the provided code via exec().
        """
        return f"""
import sys
try:
    import resource
    # Set Memory Limit
    memory_limit = {cls.MAX_MEMORY_MB} * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
    
    # Set CPU Time Limit
    cpu_limit = {cls.MAX_CPU_TIME_SECONDS}
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit, cpu_limit))
except ImportError:
    pass # Windows doesn't support the resource module, fall back to asyncio timeouts

code = {repr(code)}

try:
    exec(code, {{"__name__": "__main__"}})
except MemoryError:
    print("Error: Memory limit exceeded.", file=sys.stderr)
    sys.exit(137) # Typically used for OOM/SIGKILL
except Exception as e:
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
"""
