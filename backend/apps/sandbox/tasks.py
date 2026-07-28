import logging
from .services.execution_tracker import ExecutionTracker

logger = logging.getLogger(__name__)


def cleanup_stale_sandbox_sessions():
    """
    Periodic task to sweep for stale sandbox sessions that missed the normal disconnect hook.
    Sessions use a 30-minute TTL in cache, but we sweep to ensure cleanup logic runs if needed.
    """
    active_sessions = ExecutionTracker.get_all_active_sessions()
    cleaned_count = 0

    for session_id in list(active_sessions):
        # The cache key TTL handles automatic eviction from memory.
        # If the key is missing, it means it expired (stale > 30 mins) or was deleted.
        if not ExecutionTracker.get_session_state(session_id):
            try:
                # Run any cleanup hooks here (e.g. killing zombie debug processes tied to session)
                logger.info(f"Sweeping stale sandbox session: {session_id}")
                ExecutionTracker.reset(session_id)
                cleaned_count += 1
            except Exception as e:
                logger.warning(f"Error cleaning up stale session {session_id}: {e}")

    if cleaned_count > 0:
        logger.info(f"Cleaned up {cleaned_count} stale sandbox sessions.")
