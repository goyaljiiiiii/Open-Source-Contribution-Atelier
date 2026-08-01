import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.models import (
    Notification,
    NotificationDeadLetter,
    NotificationDelivery,
    NotificationPreference,
    PushSubscription,
)

User = get_user_model()


@pytest.mark.django_db
def test_notification_list_unauthenticated():
    client = APIClient()
    url = reverse("notification-list")
    response = client.get(url)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_notification_list_authenticated():
    user1 = User.objects.create_user(username="notif_user1", password="password123")
    user2 = User.objects.create_user(username="notif_user2", password="password123")

    notif1 = Notification.objects.create(
        recipient=user1,
        notif_type="badge",
        title="Welcome Badge",
        message="You earned a badge!",
    )
    notif2 = Notification.objects.create(
        recipient=user2,
        notif_type="comment",
        title="New Comment",
        message="User2 comment",
    )

    client = APIClient()
    client.force_authenticate(user=user1)
    url = reverse("notification-list")
    response = client.get(url)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    # Handle list or paginated response format
    results = data.get("results", data) if isinstance(data, dict) else data
    assert len(results) == 1
    assert results[0]["title"] == "Welcome Badge"


@pytest.mark.django_db
def test_mark_one_read_and_not_found():
    user1 = User.objects.create_user(username="mark_user1", password="password123")
    user2 = User.objects.create_user(username="mark_user2", password="password123")

    notif = Notification.objects.create(
        recipient=user1,
        notif_type="achievement",
        title="Achievement Unlocked",
        message="Awesome job!",
        is_read=False,
    )

    client = APIClient()
    client.force_authenticate(user=user2)
    # User2 trying to read User1's notification -> 404
    url_user2 = reverse("notification-mark-one", kwargs={"pk": notif.pk})
    resp_404 = client.post(url_user2)
    assert resp_404.status_code == status.HTTP_404_NOT_FOUND

    # User1 marking their notification read -> 200
    client.force_authenticate(user=user1)
    resp_200 = client.post(url_user2)
    assert resp_200.status_code == status.HTTP_200_OK
    notif.refresh_from_db()
    assert notif.is_read is True


@pytest.mark.django_db
def test_mark_all_read():
    user = User.objects.create_user(username="markall_user", password="password123")
    for i in range(3):
        Notification.objects.create(
            recipient=user,
            notif_type="lesson_completed",
            title=f"Lesson {i}",
            message=f"Completed {i}",
            is_read=False,
        )

    client = APIClient()
    client.force_authenticate(user=user)
    url = reverse("notification-mark-all")
    response = client.post(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["marked_read"] == 3
    assert Notification.objects.filter(recipient=user, is_read=False).count() == 0


@pytest.mark.django_db
def test_notification_preferences():
    user = User.objects.create_user(username="prefs_user", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)

    url = reverse("notification-prefs")
    get_resp = client.get(url)
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["email"] is True

    put_resp = client.put(
        url, {"email": False, "in_app": True, "websocket": False}, format="json"
    )
    assert put_resp.status_code == status.HTTP_200_OK
    assert put_resp.json()["email"] is False

    prefs = NotificationPreference.objects.get(user=user)
    assert prefs.email_enabled is False


@pytest.mark.django_db
def test_push_subscription_flow():
    user = User.objects.create_user(username="push_user", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)

    sub_url = reverse("push-subscribe")
    payload = {
        "endpoint": "https://push.example.com/sub/123",
        "p256dh": "dummy_p256dh_key",
        "auth": "dummy_auth_key",
    }
    sub_resp = client.post(sub_url, payload, format="json")
    assert sub_resp.status_code == status.HTTP_200_OK
    assert PushSubscription.objects.filter(user=user).count() == 1

    unsub_url = reverse("push-unsubscribe")
    unsub_resp = client.post(
        unsub_url, {"endpoint": "https://push.example.com/sub/123"}, format="json"
    )
    assert unsub_resp.status_code == status.HTTP_200_OK
    assert PushSubscription.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_digest_endpoints():
    user = User.objects.create_user(username="digest_user", password="password123")
    Notification.objects.create(
        recipient=user,
        notif_type="badge",
        title="Digest Badge",
        message="Daily digest item",
        is_read=False,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    digest_url = reverse("notification-digest")
    resp = client.get(digest_url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["unread_count"] == 1

    digest_read_url = reverse("notification-digest-read")
    read_resp = client.post(digest_read_url)
    assert read_resp.status_code == status.HTTP_200_OK
    assert Notification.objects.filter(recipient=user, is_read=False).count() == 0


@pytest.mark.django_db
def test_delivery_and_dead_letter_models():
    user = User.objects.create_user(username="delivery_user", password="password123")
    notif = Notification.objects.create(
        recipient=user,
        notif_type="badge",
        title="Delivery Test",
        message="Test delivery model",
    )

    delivery = NotificationDelivery.objects.create(
        notification=notif,
        recipient=user,
        channel="email",
        status="sent",
    )
    assert str(delivery).startswith(f"Delivery #{delivery.id}")

    dead_letter = NotificationDeadLetter.objects.create(
        notification=notif,
        recipient=user,
        channel="push",
        retry_count=3,
        error_message="Endpoint invalid",
    )
    assert "DeadLetter [push]" in str(dead_letter)
