import logging
import os
import shutil
import time
from pathlib import Path

from django.conf import settings

from .services.execution_tracker import ExecutionTracker

logger = logging.getLogger(__name__)


def cleanup_stale_sandbox_sessions():
    """
    Periodic task to sweep for stale sandbox sessions that missed the normal disconnect hook.
    Sessions use a 30-minute TTL in cache, but we sweep to ensure cleanup logic runs if needed.
    Also cleans up expired session directories in SANDBOX_SESSIONS_DIR older than 24 hours.
    """
    active_sessions = ExecutionTracker.get_all_active_sessions()
    cleaned_count = 0
    freed_bytes = 0

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

    sessions_dir_path = getattr(settings, "SANDBOX_SESSIONS_DIR", None)
    if sessions_dir_path:
        sessions_dir = Path(sessions_dir_path)
        if sessions_dir.exists() and sessions_dir.is_dir():
            now_time = time.time()
            max_age_seconds = 24 * 3600
            for item in sessions_dir.iterdir():
                if item.is_dir():
                    try:
                        mtime = item.stat().st_mtime
                        if now_time - mtime > max_age_seconds:
                            dir_size = sum(
                                f.stat().st_size
                                for f in item.glob("**/*")
                                if f.is_file()
                            )
                            shutil.rmtree(item)
                            cleaned_count += 1
                            freed_bytes += dir_size
                    except Exception as e:
                        logger.warning(
                            f"Error removing expired sandbox session dir {item}: {e}"
                        )

    if cleaned_count > 0:
        logger.info(
            f"Cleaned up {cleaned_count} stale sandbox sessions ({freed_bytes} bytes freed)."
        )

    return {"cleaned_count": cleaned_count, "freed_bytes": freed_bytes}


cleanup_expired_sandbox_sessions = cleanup_stale_sandbox_sessions
