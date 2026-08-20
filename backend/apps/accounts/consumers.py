"""WebSocket consumer with Redis-backed JWT rotation/revocation."""

from __future__ import annotations

import asyncio
import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .token_rotation import token_event_channel

logger = logging.getLogger(__name__)
User = get_user_model()


class JWTTokenRotationConsumer(AsyncJsonWebsocketConsumer):
    """Authenticated WS endpoint that reacts to per-user JWT lifecycle events."""

    async def connect(self):
        self.redis = None
        self.pubsub = None
        self.pubsub_task = None
        self.closed_by_token_event = False

        token = self._get_token()
        if not token:
            await self.close(code=4001)
            return

        try:
            access = AccessToken(token)
            access.verify()
            user_id = access.get("user_id")
            jti = access.get("jti")
            if not user_id or not jti:
                raise TokenError("JWT is missing user_id or jti")
            user = await self._get_user(user_id)
        except Exception:
            await self.close(code=4001)
            return

        self.scope["user"] = user
        self.user_id = user.pk
        self.current_jti = str(jti)
        self.event_channel = token_event_channel(self.user_id)

        await self.accept(subprotocol=self._accepted_subprotocol())
        await self._subscribe()
        self.pubsub_task = asyncio.create_task(self._listen_for_token_events())

    async def disconnect(self, close_code):
        await self._cleanup_pubsub()

    def _get_token(self) -> str | None:
        subprotocols = self.scope.get("subprotocols", [])
        if len(subprotocols) >= 2 and subprotocols[0] == "token":
            return subprotocols[1]

        query = parse_qs(self.scope.get("query_string", b"").decode())
        values = query.get("token")
        return values[0] if values else None

    def _accepted_subprotocol(self) -> str | None:
        subprotocols = self.scope.get("subprotocols", [])
        if len(subprotocols) >= 2 and subprotocols[0] == "token":
            return "token"
        return None

    async def _subscribe(self):
        import redis.asyncio as redis

        url = getattr(self._settings, "REDIS_URL", "") or "redis://127.0.0.1:6379/0"
        self.redis = redis.from_url(url, decode_responses=True)
        self.pubsub = self.redis.pubsub(ignore_subscribe_messages=True)
        await self.pubsub.subscribe(self.event_channel)

    @property
    def _settings(self):
        from django.conf import settings
        return settings

    async def _listen_for_token_events(self):
        try:
            while True:
                message = await self.pubsub.get_message(timeout=1.0)
                if not message:
                    await asyncio.sleep(0.01)
                    continue

                try:
                    event = json.loads(message["data"])
                except (TypeError, json.JSONDecodeError):
                    continue

                event_type = event.get("type")
                if event_type == "token_revoked":
                    await self._close_for_token_change()
                    return

                if event_type == "token_refreshed" and str(event.get("jti")) != self.current_jti:
                    await self._close_for_token_change()
                    return
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WebSocket JWT pub/sub listener failed")
            await self._close_for_token_change()

    async def _close_for_token_change(self):
        if self.closed_by_token_event:
            return
        self.closed_by_token_event = True
        await self.close(code=4001)

    async def _cleanup_pubsub(self):
        if self.pubsub_task:
            current = asyncio.current_task()
            if self.pubsub_task is not current:
                self.pubsub_task.cancel()
                try:
                    await self.pubsub_task
                except asyncio.CancelledError:
                    pass
            self.pubsub_task = None

        if self.pubsub:
            try:
                await self.pubsub.unsubscribe(self.event_channel)
            except Exception:
                logger.debug("WebSocket Redis unsubscribe failed", exc_info=True)
            try:
                await self.pubsub.close()
            except Exception:
                logger.debug("WebSocket Redis pub/sub close failed", exc_info=True)
            self.pubsub = None

        if self.redis:
            try:
                await self.redis.close()
            except Exception:
                logger.debug("WebSocket Redis connection close failed", exc_info=True)
            self.redis = None

    @database_sync_to_async
    def _get_user(self, user_id):
        return User.objects.get(pk=user_id)
