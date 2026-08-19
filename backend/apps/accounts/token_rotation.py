"""Redis-backed WebSocket JWT rotation and revocation helpers."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis
from django.conf import settings

logger = logging.getLogger(__name__)

CHANNEL_TEMPLATE = "ws_token_events:{user_id}"
TOKEN_REFRESHED = "token_refreshed"
TOKEN_REVOKED = "token_revoked"


def token_event_channel(user_id: int | str) -> str:
    return CHANNEL_TEMPLATE.format(user_id=user_id)


def _redis_url() -> str:
    return getattr(settings, "REDIS_URL", "") or "redis://127.0.0.1:6379/0"


def publish_token_event(user_id: int | str, event_type: str, jti: str | None = None) -> None:
    """Publish a token lifecycle event; Redis outages never break authentication."""
    payload: dict[str, Any] = {"type": event_type}
    if jti:
        payload["jti"] = jti

    try:
        client = redis.Redis.from_url(_redis_url(), decode_responses=True)
        client.publish(token_event_channel(user_id), json.dumps(payload))
        client.close()
    except Exception:
        logger.exception("Unable to publish WebSocket token event for user %s", user_id)


def publish_token_refreshed(user_id: int | str, jti: str) -> None:
    publish_token_event(user_id, TOKEN_REFRESHED, jti)


def publish_token_revoked(user_id: int | str, jti: str | None = None) -> None:
    publish_token_event(user_id, TOKEN_REVOKED, jti)
