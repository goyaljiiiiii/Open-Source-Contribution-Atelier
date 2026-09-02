from __future__ import annotations

import logging
from typing import Any, Optional

from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


def safe_parse_date(date_str: Optional[str]):
    if not date_str:
        return None
    try:
        # Accept YYYY-MM-DD
        from datetime import datetime

        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception as e:
        logger.warning("Caught exception: %s", e)
        return None


def log_moderation_action(
    content_report: Any,
    moderator: Any,
    target_user: Any,
    status_after: str,
    status_before: Optional[str] = None,
    action_taken: Optional[str] = None,
    reason: str = "",
    event_type: Optional[str] = None,
):
    """
    Log a moderation audit event, mandating target_user alongside moderator.
    """
    from apps.moderation.models import ModerationAuditEvent

    if target_user is None:
        raise ValueError("target_user is required for moderation audit log entries.")

    if isinstance(target_user, (int, str)):
        target_user_obj = User.objects.filter(pk=target_user).first()
    else:
        target_user_obj = target_user

    if isinstance(moderator, (int, str)):
        moderator_obj = User.objects.filter(pk=moderator).first()
    else:
        moderator_obj = moderator

    if not event_type:
        event_type = f"REPORT_{status_after}"

    return ModerationAuditEvent.objects.create(
        content_report=content_report,
        moderator=moderator_obj,
        target_user=target_user_obj,
        status_before=status_before,
        status_after=status_after,
        action_taken=action_taken or getattr(content_report, "action_taken", ""),
        reason=reason,
        event_type=event_type,
    )
