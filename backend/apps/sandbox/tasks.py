import logging
import shutil
import tempfile
import time
from pathlib import Path

from celery import shared_task
from django.conf import settings

from .services.execution_tracker import ExecutionTracker

logger = logging.getLogger(__name__)

SANDBOX_SESSION_TTL_SECONDS = 24 * 60 * 60

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


def _get_sandbox_sessions_dir() -> Path:
    """Base directory where guest sandbox session workspace files live."""
    configured = getattr(settings, "SANDBOX_SESSIONS_DIR", None)
    if configured:
        return Path(configured)
    return Path(tempfile.gettempdir()) / "atelier_sandbox_sessions"


def _dir_size_bytes(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


@shared_task
def cleanup_expired_sandbox_sessions():
    """
    Daily Celery beat task that deletes guest sandbox session directories
    whose contents have not been modified in the last 24 hours, freeing
    disk space left behind by anonymous sandbox users. Active sessions
    (modified within the last 24 hours) are left untouched.
    """
    sessions_dir = _get_sandbox_sessions_dir()

    if not sessions_dir.exists():
        logger.info(f"Sandbox sessions directory does not exist: {sessions_dir}")
        return {"cleaned_count": 0, "freed_bytes": 0}

    cutoff = time.time() - SANDBOX_SESSION_TTL_SECONDS
    cleaned_count = 0
    freed_bytes = 0

    for session_path in sessions_dir.iterdir():
        if not session_path.is_dir():
            continue

        try:
            if session_path.stat().st_mtime >= cutoff:
                continue  # still active, leave it alone

            freed_bytes += _dir_size_bytes(session_path)
            shutil.rmtree(session_path)
            cleaned_count += 1
        except Exception as e:
            logger.warning(f"Error cleaning up sandbox session dir {session_path}: {e}")

    if cleaned_count:
        logger.info(
            f"Cleaned up {cleaned_count} expired sandbox session directories, "
            f"freed {freed_bytes / (1024 * 1024):.2f} MB."
        )

    return {"cleaned_count": cleaned_count, "freed_bytes": freed_bytes}