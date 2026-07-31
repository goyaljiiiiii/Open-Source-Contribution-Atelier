from django.conf import settings
from django.db import connection


def apply_lock_timeout(timeout_ms=None):
    if timeout_ms is None:
        timeout_ms = getattr(settings, "DATABASE_LOCK_TIMEOUT", 5000)
    with connection.cursor() as cursor:
        cursor.execute(
            "SET lock_timeout = %s;",
            [f"{timeout_ms}ms"],
        )
