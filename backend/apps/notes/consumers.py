import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from .services.collaboration import collab_manager

logger = logging.getLogger(__name__)

USER_COLORS = [
    "#4ECDC4", "#45B7D1", "#FF6B6B", "#A78BFA",
    "#F59E0B", "#10B981", "#EC4899", "#3B82F6"
]


class CollabNotesConsumer(AsyncJsonWebsocketConsumer):
    """
    Django Channels WebSocket consumer for real-time collaborative document editing,
    multiplayer cursor tracking, and presence updates.
    """

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"].get("room_id", "general")
        self.room_group_name = f"collab_notes_{self.room_id}"

        # Assign user identifier & avatar color
        user = self.scope.get("user")
        self.user_id = str(user.id) if user and user.is_authenticated else f"anon_{self.channel_name[-6:]}"
        self.username = user.username if user and user.is_authenticated else f"Contributor_{self.channel_name[-4:]}"
        color_idx = hash(self.user_id) % len(USER_COLORS)
        self.user_color = USER_COLORS[color_idx]

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Register peer in manager
        collab_manager.update_peer(
            room_id=self.room_id,
            user_id=self.user_id,
            username=self.username,
            color=self.user_color
        )

        room_data = collab_manager.get_or_create_room(self.room_id)

        # Send initial room snapshot to newly connected client
        await self.send_json({
            "type": "init_state",
            "room_id": self.room_id,
            "content": room_data["content"],
            "user_id": self.user_id,
            "username": self.username,
            "user_color": self.user_color,
            "peers": collab_manager.get_room_peers(self.room_id)
        })

        # Broadcast user join event to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "peer_event",
                "event": "join",
                "user_id": self.user_id,
                "username": self.username,
                "user_color": self.user_color,
                "peers": collab_manager.get_room_peers(self.room_id)
            }
        )

    async def disconnect(self, close_code):
        # Unregister peer
        collab_manager.remove_peer(self.room_id, self.user_id)

        # Leave group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Broadcast leave event
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "peer_event",
                "event": "leave",
                "user_id": self.user_id,
                "username": self.username,
                "peers": collab_manager.get_room_peers(self.room_id)
            }
        )

    async def receive_json(self, content):
        action = content.get("action")

        if action == "content_change":
            new_content = content.get("content", "")
            collab_manager.update_content(self.room_id, new_content)

            # Broadcast content change to all other peers in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "content_broadcast",
                    "sender_id": self.user_id,
                    "content": new_content,
                }
            )

        elif action == "cursor_move":
            cursor_pos = content.get("cursor", {"line": 1, "column": 1})
            collab_manager.update_peer(
                room_id=self.room_id,
                user_id=self.user_id,
                username=self.username,
                color=self.user_color,
                cursor=cursor_pos
            )

            # Broadcast cursor movement
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "cursor_broadcast",
                    "sender_id": self.user_id,
                    "username": self.username,
                    "color": self.user_color,
                    "cursor": cursor_pos,
                }
            )

    async def content_broadcast(self, event):
        # Do not echo back to sender
        if event["sender_id"] != self.user_id:
            await self.send_json({
                "type": "content_update",
                "content": event["content"]
            })

    async def cursor_broadcast(self, event):
        if event["sender_id"] != self.user_id:
            await self.send_json({
                "type": "cursor_update",
                "sender_id": event["sender_id"],
                "username": event["username"],
                "color": event["color"],
                "cursor": event["cursor"]
            })

    async def peer_event(self, event):
        await self.send_json({
            "type": "peer_update",
            "event": event["event"],
            "user_id": event["user_id"],
            "username": event.get("username", ""),
            "peers": event["peers"]
        })
