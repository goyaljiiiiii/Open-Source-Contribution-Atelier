import logging

logger = logging.getLogger(__name__)
import functools
import hashlib
import json

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response

try:
    from prometheus_client import Gauge

    SANDBOX_ACTIVE_SESSIONS = Gauge(
        "sandbox_active_sessions", "Number of active sandbox sessions"
    )
except ImportError:
    SANDBOX_ACTIVE_SESSIONS = None


class ExecutionTracker:
    @staticmethod
    def _get_key(user_id, code, payload):
        payload_str = json.dumps(payload, sort_keys=True)
        raw = f"{user_id}:{code}:{payload_str}"
        h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return f"execution_tracker:{h}"

    @classmethod
    def is_duplicate(cls, user_id, code, payload) -> bool:
        key = cls._get_key(user_id, code, payload)
        return bool(cache.get(key))

    @classmethod
    def mark_execution_used(cls, user_id, code, payload):
        key = cls._get_key(user_id, code, payload)
        cache.set(key, True, timeout=86400)  # Duplicate for 24 hours

        try:
            import datetime

            from django.utils import timezone

            from apps.gamification.models import Streak

            today = timezone.localdate()
            streak, _ = Streak.objects.get_or_create(user_id=user_id)

            if streak.last_activity_date != today:
                if streak.last_activity_date == today - datetime.timedelta(days=1):
                    streak.current_streak += 1
                else:
                    streak.current_streak = 1

                streak.last_activity_date = today
                if streak.current_streak > streak.longest_streak:
                    streak.longest_streak = streak.current_streak
                streak.save(
                    update_fields=[
                        "current_streak",
                        "longest_streak",
                        "last_activity_date",
                    ]
                )
        except Exception as e:
            logger.warning("Caught exception: %s", e)

    @classmethod
    def clear_execution(cls, user_id, code, payload):
        key = cls._get_key(user_id, code, payload)
        cache.delete(key)

    @classmethod
    def set_session_state(cls, session_id: str, state_data: dict):
        cache.set(f"sandbox_session:{session_id}", state_data, timeout=1800)
        cls._add_to_active_sessions(session_id)

    @classmethod
    def get_session_state(cls, session_id: str):
        return cache.get(f"sandbox_session:{session_id}")

    @classmethod
    def reset(cls, session_id: str):
        cache.delete(f"sandbox_session:{session_id}")
        cls._remove_from_active_sessions(session_id)

    @classmethod
    def _add_to_active_sessions(cls, session_id: str):
        active_sessions = cache.get("sandbox_active_sessions_list", set())
        if session_id not in active_sessions:
            active_sessions.add(session_id)
            cache.set("sandbox_active_sessions_list", active_sessions, timeout=None)
            if SANDBOX_ACTIVE_SESSIONS is not None:
                SANDBOX_ACTIVE_SESSIONS.inc()

    @classmethod
    def _remove_from_active_sessions(cls, session_id: str):
        active_sessions = cache.get("sandbox_active_sessions_list", set())
        if session_id in active_sessions:
            active_sessions.discard(session_id)
            cache.set("sandbox_active_sessions_list", active_sessions, timeout=None)
            if SANDBOX_ACTIVE_SESSIONS is not None:
                SANDBOX_ACTIVE_SESSIONS.dec()

    @classmethod
    def get_all_active_sessions(cls):
        return cache.get("sandbox_active_sessions_list", set())


def prevent_duplicate_execution(get_user_id, get_code, get_payload):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapped_view(self, request, *args, **kwargs):
            user_id = get_user_id(request)
            code = get_code(request)
            payload = get_payload(request)

            if ExecutionTracker.is_duplicate(user_id, code, payload):
                return Response(
                    {
                        "error": "duplicate_execution",
                        "message": "This execution has already been tracked or completed.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            return view_func(self, request, *args, **kwargs)

        return wrapped_view

    return decorator
