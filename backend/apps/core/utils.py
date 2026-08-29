from functools import wraps

from django.contrib.contenttypes.models import ContentType

from apps.core.middleware import get_current_audit_info
from apps.core.models import AdminAuditLog


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


def parse_iso_datetime(date_str: str, return_date=False):
    """
    Parse an ISO 8601 date or datetime string into a timezone-aware datetime object.
    
    Handles both:
    - Date strings: "YYYY-MM-DD" → datetime at midnight in UTC
    - Full ISO datetime: "YYYY-MM-DDTHH:MM:SS[Z]" → parsed with timezone
    
    Args:
        date_str: ISO 8601 date or datetime string
        return_date: If True, return date() instead of datetime (for progress views)
    
    Returns:
        timezone-aware datetime object, or date object if return_date=True.
        Returns None if parsing fails.
    
    Example:
        >>> parse_iso_datetime("2024-01-15")
        datetime.datetime(2024, 1, 15, 0, 0, tzinfo=datetime.timezone.utc)
        
        >>> parse_iso_datetime("2024-01-15", return_date=True)
        datetime.date(2024, 1, 15)
    """
    if not date_str:
        return None
    
    from datetime import datetime, timezone as dt_timezone
    
    try:
        # Try parsing as full ISO datetime first (handles ISO format with timezone)
        if 'T' in date_str:
            from django.utils.dateparse import parse_datetime
            dt = parse_datetime(date_str)
            if dt:
                if return_date:
                    return dt.date()
                return dt
        
        # Fall back to simple date parsing (YYYY-MM-DD)
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        # Make timezone-aware (UTC)
        dt = dt.replace(tzinfo=dt_timezone.utc)
        
        if return_date:
            return dt.date()
        return dt
    
    except (ValueError, TypeError):
        return None