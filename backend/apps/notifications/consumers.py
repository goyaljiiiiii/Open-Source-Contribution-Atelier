import asyncio
import contextlib
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

from apps.core.channel_safety import safe_group_add, safe_group_discard

from .metrics import ws_connection_closed, ws_connection_opened
from .models import Notification

logger = logging.getLogger(__name__)

# Heartbeat defaults; override in settings for tests or tuning.
DEFAULT_HEARTBEAT_INTERVAL = 30  # seconds between server pings
DEFAULT_MAX_MISSED_PONGS = 3  # consecutive unanswered pings before force-close
WS_CLOSE_HEARTBEAT_TIMEOUT = 4002  # client stopped answering pings
WS_CLOSE_HEARTBEAT_ERROR = 4003  # heartbeat itself failed unexpectedly


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that each authenticated user connects to.
    Group name  →  notifications_<user_id>
    """

    async def connect(self):
        user = self.scope.get("user")

        # Reject anonymous connections
        if not user or not user.is_authenticated:
            logger.warning("WS rejected: unauthenticated user")
            await self.close(code=4001)
            return

        self.user_id = str(user.id)
        self.group_name = f"notifications_{self.user_id}"
        self.realtime_degraded = False
        self._missed_pongs = 0
        self._heartbeat_task = None
        self._counted = False

        # Join personal channel group — degrade if Redis/channel layer is down
        joined = await safe_group_add(self.group_name, self.channel_name)
        if not joined:
            self.realtime_degraded = True
            logger.warning(
                "WS connected in degraded mode (no channel group): user=%s",
                self.user_id,
            )

        await self.accept()
        logger.info("WS connected: user=%s group=%s", self.user_id, self.group_name)

        # Send unread count on connect
        unread = await self.get_unread_count(user)
        payload = {
            "type": "connection_established",
            "unread_count": unread,
        }
        if self.realtime_degraded:
            payload["degraded"] = True
            payload["detail"] = (
                "Realtime channel layer unavailable; inbox will poll over HTTP."
            )
        await self.send(text_data=json.dumps(payload))

        # Count the live connection and start the heartbeat only once the
        # socket is fully established, so rejected connects never leak either.
        ws_connection_opened()
        self._counted = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def disconnect(self, close_code):
        # Cancel the heartbeat first: an orphaned task keeps a reference to
        # this consumer (and its channel) alive for the process lifetime.
        await self._cancel_heartbeat()

        if getattr(self, "_counted", False):
            ws_connection_closed()
            self._counted = False

        if hasattr(self, "group_name"):
            await safe_group_discard(self.group_name, self.channel_name)
            logger.info(
                "WS disconnected: group=%s code=%s", self.group_name, close_code
            )

    # ------------------------------------------------------------------ #
    # Heartbeat                                                           #
    # ------------------------------------------------------------------ #
    async def _heartbeat_loop(self):
        """
        Ping the client every ``interval`` seconds. Each ping optimistically
        increments the missed counter; an inbound pong resets it. After
        ``max_missed`` consecutive unanswered pings the socket is closed so
        half-open connections cannot accumulate.
        """
        interval = getattr(
            settings, "NOTIFICATIONS_WS_HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL
        )
        max_missed = getattr(
            settings, "NOTIFICATIONS_WS_MAX_MISSED_PONGS", DEFAULT_MAX_MISSED_PONGS
        )

        try:
            while True:
                await asyncio.sleep(interval)

                if self._missed_pongs >= max_missed:
                    logger.warning(
                        "WS heartbeat timeout: user=%s missed=%s — closing",
                        getattr(self, "user_id", "?"),
                        self._missed_pongs,
                    )
                    await self.close(code=WS_CLOSE_HEARTBEAT_TIMEOUT)
                    return

                self._missed_pongs += 1
                await self.send(text_data=json.dumps({"type": "ping"}))
        except asyncio.CancelledError:
            raise
        except Exception:
            # A heartbeat that dies quietly leaves the socket open with nothing
            # left to notice it went half-open — the exact leak this loop
            # exists to prevent. Close it under a distinct code so an internal
            # failure stays separable from a genuine client timeout.
            logger.exception(
                "WS heartbeat loop failed: user=%s", getattr(self, "user_id", "?")
            )
            with contextlib.suppress(Exception):
                await self.close(code=WS_CLOSE_HEARTBEAT_ERROR)

    async def _cancel_heartbeat(self):
        """Cancel and await the heartbeat task so no orphan survives disconnect."""
        task = getattr(self, "_heartbeat_task", None)
        self._heartbeat_task = None
        if task is None or task.done():
            return

        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task

    # Messages received FROM the browser (e.g. mark-as-read)
    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
            action = data.get("action")

            if action == "pong":
                # Client is alive — clear the missed-ping counter.
                self._missed_pongs = 0
                return

            if action == "ping":
                # Client-initiated keepalive.
                self._missed_pongs = 0
                await self.send(text_data=json.dumps({"type": "pong"}))
                return

            if action == "mark_read":
                notif_id = data.get("notification_id")
                if notif_id:
                    await self.mark_notification_read(notif_id)
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "marked_read",
                                "notification_id": notif_id,
                            }
                        )
                    )
        except json.JSONDecodeError:
            logger.error("WS receive: invalid JSON")

    # ------------------------------------------------------------------ #
    # Channel-layer event handlers  (called by group_send)               #
    # ------------------------------------------------------------------ #
    async def send_notification(self, event):
        """Relay a notification pushed by a signal / task."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "notification",
                    "notification": event["notification"],
                }
            )
        )

    # ------------------------------------------------------------------ #
    # DB helpers (run in thread pool)                                     #
    # ------------------------------------------------------------------ #
    @database_sync_to_async
    def get_unread_count(self, user):
        from .models import Notification

        return Notification.objects.filter(recipient=user, is_read=False).count()

    @database_sync_to_async
    def mark_notification_read(self, notif_id):
        from .models import Notification

        Notification.objects.filter(id=notif_id, recipient=self.scope["user"]).update(
            is_read=True
        )


class LeaderboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for live leaderboard updates.
    Group name  →  leaderboard
    """

    async def connect(self):
        user = self.scope.get("user")

        # Reject anonymous connections
        if not user or not user.is_authenticated:
            logger.warning("WS Leaderboard rejected: unauthenticated user")
            await self.close(code=4001)
            return

        self.group_name = "leaderboard"

        joined = await safe_group_add(self.group_name, self.channel_name)
        await self.accept()
        if not joined:
            logger.warning(
                "WS Leaderboard degraded (no channel group): user=%s", user.id
            )
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "connection_established",
                        "degraded": True,
                        "detail": (
                            "Realtime leaderboard unavailable; "
                            "Redis/channel layer down."
                        ),
                    }
                )
            )
        else:
            logger.info(
                "WS Leaderboard connected: user=%s group=%s", user.id, self.group_name
            )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await safe_group_discard(self.group_name, self.channel_name)
            logger.info(
                "WS Leaderboard disconnected: group=%s code=%s",
                self.group_name,
                close_code,
            )

    async def leaderboard_update(self, event):
        """Relay leaderboard update event to the websocket client."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "leaderboard_update",
                    "event": event.get("event", "xp_update"),
                    "user_id": event.get("user_id"),
                    "username": event.get("username"),
                    "xp": event.get("xp"),
                    "message": event.get("message", "Leaderboard update triggered"),
                }
            )
        )
