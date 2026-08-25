import pytest
from django.contrib.auth import get_user_model

User = get_user_model()
from rest_framework.test import APIClient

from apps.notifications.models import Notification


@pytest.fixture
def user_a(db):
    return User.objects.create_user(username="user_a", password="pass")


@pytest.fixture
def user_b(db):
    return User.objects.create_user(username="user_b", password="pass")


@pytest.fixture
def notif_for_a(db, user_a):
    return Notification.objects.create(
        recipient=user_a,
        message="Hello user_a",
        is_read=False,
    )


@pytest.fixture
def notif_for_b(db, user_b):
    return Notification.objects.create(
        recipient=user_b,
        message="Hello user_b",
        is_read=False,
    )


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_list_shows_only_own_notifications(user_a, user_b, notif_for_a, notif_for_b):
    client = auth_client(user_a)
    response = client.get("/api/notifications/")
    assert response.status_code == 200
    payload = response.data
    assert "results" in payload
    ids = [n["id"] for n in payload["results"]]
    assert notif_for_a.id in ids
    assert notif_for_b.id not in ids


def test_list_is_paginated_and_sender_is_selected(user_a, db):
    sender = User.objects.create_user(username="notification_sender", password="pass")
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user_a,
                sender=sender,
                notif_type="comment",
                title=f"Notification {index}",
                message="Paginated notification",
            )
            for index in range(25)
        ]
    )

    client = auth_client(user_a)
    response = client.get("/api/notifications/")

    assert response.status_code == 200
    assert response.data["count"] == 25
    assert len(response.data["results"]) == 20
    assert response.data["next"] is not None
    assert all(item["sender_username"] == "notification_sender" for item in response.data["results"])


def test_digest_is_paginated_and_includes_unread_count(user_a, db):
    Notification.objects.bulk_create(
        [
            Notification(
                recipient=user_a,
                notif_type="achievement",
                title=f"Unread {index}",
                message="Unread digest item",
                is_read=False,
            )
            for index in range(25)
        ]
    )

    client = auth_client(user_a)
    response = client.get("/api/notifications/digest/")

    assert response.status_code == 200
    assert response.data["count"] == 25
    assert response.data["unread_count"] == 25
    assert len(response.data["results"]) == 20
    assert response.data["next"] is not None


def test_list_requires_auth(db):
    client = APIClient()
    response = client.get("/api/notifications/")
    assert response.status_code == 401


def test_mark_one_read(user_a, notif_for_a):
    client = auth_client(user_a)
    response = client.post(f"/api/notifications/{notif_for_a.id}/read/")
    assert response.status_code == 200
    notif_for_a.refresh_from_db()
    assert notif_for_a.is_read is True


def test_mark_one_read_cannot_touch_other_users_notif(user_a, notif_for_b):
    client = auth_client(user_a)
    response = client.post(f"/api/notifications/{notif_for_b.id}/read/")
    assert response.status_code == 404


def test_mark_all_read(user_a, notif_for_a, user_b, notif_for_b):
    client = auth_client(user_a)
    response = client.post("/api/notifications/mark-all-read/")
    assert response.status_code == 200
    assert response.data["marked_read"] >= 1
    notif_for_a.refresh_from_db()
    assert notif_for_a.is_read is True
    notif_for_b.refresh_from_db()
    assert notif_for_b.is_read is False


def test_lesson_completed_broadcasts_to_leaderboard_channel(db, user_a):
    from unittest.mock import AsyncMock, MagicMock, patch

    from apps.content.models import Lesson
    from apps.progress.models import LessonProgress

    lesson = Lesson.objects.create(
        slug="test-lesson-broadcast",
        title="Test Lesson Broadcast",
        summary="Test Summary",
        content="Test Content",
        difficulty="beginner",
    )

    mock_layer = MagicMock()
    mock_layer.group_send = AsyncMock()

    with patch("apps.dashboard.signals.get_channel_layer", return_value=mock_layer):
        LessonProgress.objects.create(
            user=user_a,
            lesson=lesson,
            completed=True,
            score=100,
        )

        mock_layer.group_send.assert_called_once()
        args, kwargs = mock_layer.group_send.call_args
        group_name = args[0]
        payload = args[1]

        assert group_name == "leaderboard_updates"
        assert payload["type"] == "leaderboard_update"
        assert payload["event"] == "xp_update"
        assert payload["user_id"] == user_a.id
        assert payload["username"] == user_a.username
        assert isinstance(payload.get("xp"), int)
