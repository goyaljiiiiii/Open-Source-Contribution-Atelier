from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.chat.models import Message

User = get_user_model()


class ChatRoomListViewTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="alice", password="password")
        self.user2 = User.objects.create_user(username="bob", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def test_last_message_content_is_latest_by_created_at(self):
        """Verify that last_message returns the content of the latest message, not Max('content')."""
        room_id = f"dm_{self.user1.id}_{self.user2.id}"

        # Older message starting with 'z'
        m1 = Message.objects.create(
            user=self.user1,
            room_id=room_id,
            content="zzz old message",
        )

        # Newer message starting with 'a'
        m2 = Message.objects.create(
            user=self.user2,
            room_id=room_id,
            content="a new reply",
        )

        response = self.client.get("/api/chat/rooms/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        room_data = response.data[0]
        self.assertEqual(room_data["last_message"], "a new reply")
        self.assertEqual(room_data["dm_user"], "bob")

    def test_n_plus_one_query_optimization(self):
        """Verify fetching rooms for multiple DM channels executes a constant number of queries."""
        users_5 = [
            User.objects.create_user(username=f"user_{i}", password="password")
            for i in range(5)
        ]
        for u in users_5:
            room_id = f"dm_{self.user1.id}_{u.id}"
            Message.objects.create(
                user=self.user1,
                room_id=room_id,
                content=f"Hello {u.username}",
            )

        # Baseline query count for 5 rooms
        with self.assertNumQueries(8):
            resp5 = self.client.get("/api/chat/rooms/")
            self.assertEqual(resp5.status_code, 200)
            self.assertEqual(len(resp5.data), 5)

        # Add 15 more rooms (total 20 rooms)
        users_15 = [
            User.objects.create_user(username=f"user_more_{i}", password="password")
            for i in range(15)
        ]
        for u in users_15:
            room_id = f"dm_{self.user1.id}_{u.id}"
            Message.objects.create(
                user=self.user1,
                room_id=room_id,
                content=f"Hello {u.username}",
            )

        # Query count for 20 rooms must be identical (8 queries), proving no N+1
        with self.assertNumQueries(8):
            resp20 = self.client.get("/api/chat/rooms/")
            self.assertEqual(resp20.status_code, 200)
            self.assertEqual(len(resp20.data), 20)
            for item in resp20.data:
                self.assertIsNotNone(item.get("dm_user"))
