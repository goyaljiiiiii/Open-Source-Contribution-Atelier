from __future__ import annotations

import json
import logging
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.cache import cache

from apps.content.models import Lesson, LessonVersion
from apps.content.ot.engine import apply as ot_apply
from apps.content.ot.models import Operation

logger = logging.getLogger(__name__)


class LessonEditorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.lesson_slug = self.scope["url_route"]["kwargs"]["slug"]
        self.room_group_name = f"lesson_editor_{self.lesson_slug}"

        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        lesson = await self._get_lesson()
        user_can_edit = await self._user_can_edit(lesson)
        if not user_can_edit:
            await self.close()
            return

        self.lesson = lesson
        self.lesson_id = lesson.id
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send current document state to the connecting client
        doc_state = self._get_cached_doc()
        await self.send(text_data=json.dumps({
            "type": "doc_init",
            "content": doc_state,
            "revision": self._get_revision(),
        }))

        await self._broadcast_presence("join")

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )
        await self._broadcast_presence("leave")

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        data = json.loads(text_data)
        msg_type = data.get("type")

        if msg_type == "op":
            await self._handle_op(data)
        elif msg_type == "cursor":
            await self._handle_cursor(data)
        elif msg_type == "save":
            await self._handle_save(data)

    async def _handle_op(self, data):
        op: Operation = _deserialize_op(data.get("op", []))
        revision = data.get("revision", 0)
        current_rev = self._get_revision()

        if revision != current_rev:
            # Client is behind; send current state for rebase
            await self.send(text_data=json.dumps({
                "type": "rebase",
                "content": self._get_cached_doc(),
                "revision": current_rev,
            }))
            return

        # Apply operation to cached document
        doc = self._get_cached_doc()
        new_doc = ot_apply(doc, op)
        self._set_cached_doc(new_doc)
        self._increment_revision()

        # Broadcast to all other clients
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "editor_op",
                "op": data["op"],
                "revision": self._get_revision(),
                "sender_channel": self.channel_name,
            },
        )

    async def editor_op(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send(text_data=json.dumps({
                "type": "op",
                "op": event["op"],
                "revision": event["revision"],
            }))

    async def _handle_cursor(self, data):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "editor_cursor",
                "sender_channel": self.channel_name,
                "cursor": data.get("cursor"),
                "user": data.get("user"),
            },
        )

    async def editor_cursor(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send(text_data=json.dumps({
                "type": "cursor",
                "cursor": event["cursor"],
                "user": event["user"],
            }))

    async def editor_presence(self, event):
        if event["sender_channel"] != self.channel_name:
            await self.send(text_data=json.dumps({
                "type": "presence",
                "action": event["action"],
                "user": event["user"],
            }))

    async def _handle_save(self, data):
        doc = self._get_cached_doc()
        await self._persist_lesson_version(doc)
        await self.send(text_data=json.dumps({
            "type": "save_ack",
            "revision": self._get_revision(),
        }))

    async def _broadcast_presence(self, action):
        user = self.scope.get("user")
        if not user:
            return
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "editor_presence",
                "action": action,
                "user": {"id": user.id, "name": user.username},
                "sender_channel": self.channel_name,
            },
        )

    def _get_cache_key(self):
        return f"lesson_doc_{self.lesson_id}"

    def _get_rev_key(self):
        return f"lesson_rev_{self.lesson_id}"

    def _get_cached_doc(self):
        val = cache.get(self._get_cache_key())
        if val is None:
            val = self.lesson.content
            cache.set(self._get_cache_key(), val, timeout=86400)
        return val

    def _set_cached_doc(self, doc):
        cache.set(self._get_cache_key(), doc, timeout=86400)

    def _get_revision(self):
        return cache.get(self._get_rev_key(), 0)

    def _increment_revision(self):
        try:
            cache.incr(self._get_rev_key())
        except ValueError:
            cache.set(self._get_rev_key(), 1, timeout=86400)

    async def _get_lesson(self):
        from asgiref.sync import sync_to_async
        return await sync_to_async(Lesson.objects.get)(slug=self.lesson_slug)

    async def _user_can_edit(self, lesson):
        user = self.scope.get("user")
        return user is not None and user.is_authenticated and user.is_staff

    async def _persist_lesson_version(self, content):
        await database_sync_to_async(LessonVersion.objects.create)(
            lesson_id=self.lesson_id, content=content
        )


def _deserialize_op(raw: list) -> Operation:
    from apps.content.ot.models import Delete, Insert, Retain
    op = []
    for item in raw:
        if "retain" in item:
            op.append(Retain(item["retain"]))
        elif "insert" in item:
            op.append(Insert(item["insert"]))
        elif "delete" in item:
            op.append(Delete(item["delete"]))
    return op
