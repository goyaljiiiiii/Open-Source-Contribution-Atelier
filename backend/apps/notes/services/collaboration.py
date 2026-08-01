import time
from typing import Dict, List, Any


class CollabRoomManager:
    """
    In-memory state manager for real-time collaborative document rooms.
    Tracks active room buffers, peer cursor positions, and user presence.
    """

    def __init__(self):
        # { room_id: { "content": str, "peers": { user_id: { username, color, cursor } }, "last_saved": float } }
        self._rooms: Dict[str, Dict[str, Any]] = {}

    def get_or_create_room(self, room_id: str, default_title: str = "Collaborative Note") -> Dict[str, Any]:
        if room_id not in self._rooms:
            self._rooms[room_id] = {
                "room_id": room_id,
                "title": default_title,
                "content": "# Collaborative Note & Pair Programming Room\n\nStart typing live markdown or code snippets with your team!\n\n```typescript\nfunction helloAtelier(user: string) {\n  console.log(`Welcome ${user} to real-time pair programming!`);\n}\n```",
                "peers": {},
                "created_at": time.time(),
                "last_saved": time.time(),
            }
        return self._rooms[room_id]

    def update_content(self, room_id: str, content: str) -> None:
        room = self.get_or_create_room(room_id)
        room["content"] = content
        room["last_saved"] = time.time()

    def update_peer(self, room_id: str, user_id: str, username: str, color: str, cursor: Dict[str, Any] = None) -> None:
        room = self.get_or_create_room(room_id)
        room["peers"][user_id] = {
            "user_id": user_id,
            "username": username,
            "color": color,
            "cursor": cursor or {"line": 1, "column": 1},
            "last_active": time.time(),
        }

    def remove_peer(self, room_id: str, user_id: str) -> None:
        if room_id in self._rooms and user_id in self._rooms[room_id]["peers"]:
            del self._rooms[room_id]["peers"][user_id]

    def get_room_peers(self, room_id: str) -> List[Dict[str, Any]]:
        room = self.get_or_create_room(room_id)
        return list(room["peers"].values())


# Singleton instance for room collaboration service
collab_manager = CollabRoomManager()
