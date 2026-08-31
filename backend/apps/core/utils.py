from __future__ import annotations

from datetime import datetime, time
from functools import wraps

from django.contrib.contenttypes.models import ContentType
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.timezone import is_aware, make_aware

from apps.core.middleware import get_current_audit_info
from apps.core.models import AdminAuditLog


def parse_iso_datetime(date_str: str) -> datetime | None:
    """Parse an ISO 8601 date or datetime string into a timezone-aware datetime."""

    if not date_str or not str(date_str).strip():
        return None

    normalized = str(date_str).strip().replace("Z", "+00:00")
    dt = parse_datetime(normalized)
    if dt is not None:
        return dt if is_aware(dt) else make_aware(dt)

    parsed_date = parse_date(normalized)
    if parsed_date is not None:
        return make_aware(datetime.combine(parsed_date, time.min))

    return None


def log_action(action_name, get_details_func=None):
    """
    Decorator for admin views to log custom actions.
    `get_details_func` is an optional callable that takes the view arguments
    (request, *args, **kwargs) and returns a dict of details.
    """

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            response = view_func(request, *args, **kwargs)

            # Log action if successful
            if 200 <= response.status_code < 400:
                audit_info = get_current_audit_info()
                actor = audit_info.get("actor")
                ip_address = audit_info.get("ip_address")

                details = {}
                if get_details_func:
                    try:
                        details = get_details_func(request, *args, **kwargs)
                    except Exception as e:
                        details = {"error": f"Failed to get details: {str(e)}"}

                AdminAuditLog.objects.create(
                    actor=actor if actor and actor.is_authenticated else None,
                    action=action_name,
                    ip_address=ip_address,
                    details=details,
                )

            return response

        return _wrapped_view

    return decorator
