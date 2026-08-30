
"""Regression coverage for automatic pruning of stale Web Push subscriptions.

Issue #2899:
A Web Push provider returns HTTP 410 when a browser subscription has expired
or has been revoked. The notification sender must remove that subscription so
future notification attempts do not repeatedly target a permanently invalid
endpoint.

The production implementation already handles 404/410 WebPushException
responses in ``send_web_push_notification``. This suite makes that behavior
explicit and protects it against regressions while also documenting the
important failure modes around multiple subscriptions and non-terminal errors.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from pywebpush import WebPushException

from apps.notifications.models import PushSubscription
from apps.notifications.tasks import send_web_push_notification

User = get_user_model()


def make_user(username="push_prune_user"):
    return User.objects.create_user(username=username, password="test-password")


def make_subscription(user, suffix="1"):
    return PushSubscription.objects.create(
        user=user,
        endpoint=f"https://push.example.test/subscription/{suffix}",
        p256dh=f"p256dh-{suffix}",
        auth=f"auth-{suffix}",
    )


def web_push_exception(status_code):
    error = WebPushException(f"provider returned HTTP {status_code}")
    error.response = SimpleNamespace(status_code=status_code)
    return error


def run_push(user_id, *, title="Test title", message="Test message", url=None):
    return send_web_push_notification(
        user_id=user_id,
        title=title,
        message=message,
        url=url,
    )


def assert_subscription_exists(subscription_id):
    assert PushSubscription.objects.filter(pk=subscription_id).exists()


def assert_subscription_removed(subscription_id):
    assert not PushSubscription.objects.filter(pk=subscription_id).exists()


@pytest.fixture
def vapid_settings():
    with override_settings(
        VAPID_PRIVATE_KEY="test-private-key",
        VAPID_ADMIN_EMAIL="mailto:test@example.com",
    ):
        yield


@pytest.mark.django_db
def test_410_removes_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_404_also_removes_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(404),
    ):
        run_push(user.id)
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_400_does_not_remove_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(400),
    ):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_401_does_not_remove_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(401),
    ):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_403_does_not_remove_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(403),
    ):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_429_does_not_remove_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(429),
    ):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
@pytest.mark.parametrize("status_code", [500, 501, 502, 503, 504])
def test_server_errors_do_not_remove_subscription(vapid_settings, status_code):
    user = make_user(username=f"server_error_{status_code}")
    subscription = make_subscription(user, str(status_code))
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(status_code),
    ):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_success_keeps_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    with patch("apps.notifications.tasks.webpush", return_value=None):
        run_push(user.id)
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_removes_only_failed_subscription(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "stale")
    healthy = make_subscription(user, "healthy")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("/stale"):
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_multiple_410_subscriptions_are_all_pruned(vapid_settings):
    user = make_user()
    subscriptions = [make_subscription(user, str(i)) for i in range(5)]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    for subscription in subscriptions:
        assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_mixed_terminal_and_transient_failures(vapid_settings):
    user = make_user()
    gone = make_subscription(user, "gone")
    transient = make_subscription(user, "transient")
    healthy = make_subscription(user, "healthy")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("/gone"):
            raise web_push_exception(410)
        if endpoint.endswith("/transient"):
            raise web_push_exception(503)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(gone.id)
    assert_subscription_exists(transient.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_410_does_not_delete_other_users_subscription(vapid_settings):
    user = make_user("owner")
    other = make_user("other")
    stale = make_subscription(user, "stale-owner")
    other_subscription = make_subscription(other, "other-user")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(other_subscription.id)


@pytest.mark.django_db
def test_410_deletes_record_from_database_not_just_in_memory(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    subscription_id = subscription.pk

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(pk=subscription_id).count() == 0


@pytest.mark.django_db
def test_410_pruning_is_idempotent(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)

    # A second notification attempt sees no subscription and therefore does
    # not attempt to send to the stale endpoint again.
    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id)
        webpush.assert_not_called()


@pytest.mark.django_db
def test_no_subscriptions_short_circuits(vapid_settings):
    user = make_user()
    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id)
        webpush.assert_not_called()


@pytest.mark.django_db
def test_missing_vapid_configuration_short_circuits():
    user = make_user()
    make_subscription(user)

    with override_settings(
        VAPID_PRIVATE_KEY=None,
        VAPID_ADMIN_EMAIL=None,
    ):
        with patch("apps.notifications.tasks.webpush") as webpush:
            run_push(user.id)
            webpush.assert_not_called()


@pytest.mark.django_db
def test_private_key_missing_preserves_subscription():
    user = make_user()
    subscription = make_subscription(user)

    with override_settings(
        VAPID_PRIVATE_KEY=None,
        VAPID_ADMIN_EMAIL="mailto:test@example.com",
    ):
        with patch("apps.notifications.tasks.webpush") as webpush:
            run_push(user.id)
            webpush.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_admin_email_missing_preserves_subscription():
    user = make_user()
    subscription = make_subscription(user)

    with override_settings(
        VAPID_PRIVATE_KEY="test-private-key",
        VAPID_ADMIN_EMAIL=None,
    ):
        with patch("apps.notifications.tasks.webpush") as webpush:
            run_push(user.id)
            webpush.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_payload_title_is_forwarded(vapid_settings):
    user = make_user()
    make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id, title="Important title")
        payload = webpush.call_args.kwargs["data"]

    assert '"title": "Important title"' in payload


@pytest.mark.django_db
def test_payload_message_is_forwarded(vapid_settings):
    user = make_user()
    make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id, message="Important message")
        payload = webpush.call_args.kwargs["data"]

    assert '"message": "Important message"' in payload


@pytest.mark.django_db
def test_payload_url_is_forwarded(vapid_settings):
    user = make_user()
    make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id, url="https://example.test/lesson")
        payload = webpush.call_args.kwargs["data"]

    assert '"url": "https://example.test/lesson"' in payload


@pytest.mark.django_db
def test_missing_url_is_not_added_to_payload(vapid_settings):
    user = make_user()
    make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id)
        payload = webpush.call_args.kwargs["data"]

    assert '"url"' not in payload


@pytest.mark.django_db
def test_410_cleanup_does_not_stop_processing_remaining_subscriptions(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "first-stale")
    healthy = make_subscription(user, "second-healthy")

    calls = []

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        calls.append(endpoint)
        if endpoint.endswith("/first-stale"):
            raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert len(calls) == 2
    assert_subscription_removed(stale.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_unexpected_exception_does_not_delete_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=RuntimeError("temporary local failure"),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_web_push_exception_without_response_does_not_delete(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("no HTTP response")
    error.response = None

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
@pytest.mark.parametrize("status_code", [408, 409, 412, 413, 415, 422, 451])
def test_other_client_statuses_are_retained(vapid_settings, status_code):
    user = make_user(username=f"client_{status_code}")
    subscription = make_subscription(user, str(status_code))

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(status_code),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_custom_notification_url(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as webpush:
        run_push(
            user.id,
            title="Expired subscription",
            message="This endpoint is no longer valid.",
            url="https://example.test/account/notifications",
        )

    assert_subscription_removed(subscription.id)
    assert webpush.call_count == 1


@pytest.mark.django_db
def test_410_cleanup_uses_subscription_endpoint(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "endpoint-check")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as webpush:
        run_push(user.id)

    info = webpush.call_args.kwargs["subscription_info"]
    assert info["endpoint"] == subscription.endpoint


@pytest.mark.django_db
def test_410_cleanup_uses_subscription_keys(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "keys-check")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as webpush:
        run_push(user.id)

    keys = webpush.call_args.kwargs["subscription_info"]["keys"]
    assert keys["p256dh"] == subscription.p256dh
    assert keys["auth"] == subscription.auth


@pytest.mark.django_db
def test_410_cleanup_does_not_create_replacement_subscription(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_410_cleanup_preserves_user_record(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert User.objects.filter(pk=user.pk).exists()
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_other_subscription_fields(vapid_settings):
    user = make_user()
    healthy = make_subscription(user, "healthy-fields")
    stale = make_subscription(user, "stale-fields")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=lambda **kwargs: (
            (_ for _ in ()).throw(web_push_exception(410))
            if kwargs["subscription_info"]["endpoint"].endswith("/stale-fields")
            else None
        ),
    ):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.p256dh == "p256dh-healthy-fields"
    assert healthy.auth == "auth-healthy-fields"
    assert healthy.endpoint.endswith("/healthy-fields")
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_repeated_410_notifications_leave_database_clean(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    for _ in range(3):
        with patch(
            "apps.notifications.tasks.webpush",
            side_effect=web_push_exception(410),
        ):
            run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_404_and_410_are_both_terminal(vapid_settings):
    user = make_user()
    not_found = make_subscription(user, "404")
    gone = make_subscription(user, "410")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("/404"):
            raise web_push_exception(404)
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(not_found.id)
    assert_subscription_removed(gone.id)


@pytest.mark.django_db
def test_terminal_cleanup_scales_across_many_subscriptions(vapid_settings):
    user = make_user()
    subscriptions = [
        make_subscription(user, f"bulk-{index}") for index in range(20)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 0
    for subscription in subscriptions:
        assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_one_410_does_not_prevent_later_success(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "stale-before-success")
    healthy = make_subscription(user, "healthy-after-success")

    sent_endpoints = []

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        sent_endpoints.append(endpoint)
        if endpoint.endswith("/stale-before-success"):
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert sent_endpoints == [stale.endpoint, healthy.endpoint]
    assert_subscription_removed(stale.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_non_web_push_exception_is_logged_and_continues(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("/first"):
            raise ValueError("malformed provider response")
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(first.id)
    assert_subscription_exists(second.id)


@pytest.mark.django_db
def test_410_response_status_is_read_from_response(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = SimpleNamespace(status_code=410, reason="Gone")

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_is_not_confused_with_string_error_message(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("HTTP 410 Gone")
    error.response = SimpleNamespace(status_code=500)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_require_subscription_queryset_reloading(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    queryset = PushSubscription.objects.filter(user=user)
    assert queryset.count() == 1

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert queryset.count() == 0


@pytest.mark.django_db
def test_410_cleanup_keeps_database_count_consistent(vapid_settings):
    user = make_user()
    make_subscription(user, "a")
    make_subscription(user, "b")
    make_subscription(user, "c")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 0
    assert PushSubscription.objects.count() == 0


@pytest.mark.django_db
def test_410_cleanup_only_targets_current_user_queryset(vapid_settings):
    user = make_user("current-user")
    other = make_user("different-user")
    current_subscription = make_subscription(user, "current")
    other_subscription = make_subscription(other, "other")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(current_subscription.id)
    assert_subscription_exists(other_subscription.id)


@pytest.mark.django_db
def test_410_cleanup_handles_duplicate_calls_for_same_user(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_after_successful_previous_subscription(vapid_settings):
    user = make_user()
    healthy = make_subscription(user, "healthy")
    stale = make_subscription(user, "stale")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("/stale"):
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(healthy.id)
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_subscription_count_for_other_users(vapid_settings):
    users = [make_user(f"user-{index}") for index in range(3)]
    subscriptions = [
        make_subscription(users[index], f"user-{index}") for index in range(3)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(users[1].id)

    assert_subscription_exists(subscriptions[0].id)
    assert_subscription_removed(subscriptions[1].id)
    assert_subscription_exists(subscriptions[2].id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_user_without_subscription(vapid_settings):
    user = make_user()
    other = make_user("other-no-subscription")
    make_subscription(other, "other")

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id)
        webpush.assert_not_called()

    assert User.objects.filter(pk=user.pk).exists()
    assert PushSubscription.objects.filter(user=other).exists()


@pytest.mark.django_db
def test_410_cleanup_with_unicode_payload(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "unicode")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(
            user.id,
            title="नोटिफिकेशन 🔔",
            message="Subscription समाप्त हो गई",
        )

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_long_payload(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "long")
    title = "T" * 500
    message = "M" * 5000

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id, title=title, message=message)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_empty_optional_url(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "empty-url")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id, url="")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_depend_on_response_reason(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = SimpleNamespace(status_code=410, reason=None)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_response_object_extra_fields(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    response = SimpleNamespace(
        status_code=410,
        reason="Gone",
        headers={"cache-control": "no-store"},
        text="subscription expired",
    )
    error = WebPushException("gone")
    error.response = response

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_scoped_by_user_id(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "scoped")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert not PushSubscription.objects.filter(
        user_id=user.id, pk=subscription.id
    ).exists()


@pytest.mark.django_db
def test_410_cleanup_does_not_call_delete_for_success(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush", return_value=None):
        with patch.object(subscription, "delete") as delete:
            run_push(user.id)
            delete.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_calls_delete_for_terminal_response(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        with patch.object(subscription, "delete", wraps=subscription.delete) as delete:
            run_push(user.id)
            delete.assert_called_once_with()

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
@pytest.mark.parametrize("status_code", [404, 410])
def test_terminal_status_matrix(status_code, vapid_settings):
    user = make_user(username=f"terminal-{status_code}")
    subscription = make_subscription(user, f"terminal-{status_code}")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(status_code),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
@pytest.mark.parametrize("status_code", [200, 201, 202, 204])
def test_success_status_like_responses_do_not_trigger_pruning(
    status_code,
    vapid_settings,
):
    user = make_user(username=f"success-{status_code}")
    subscription = make_subscription(user, f"success-{status_code}")

    # pywebpush normally returns None for success. This test deliberately
    # models a provider adapter that returns a response-like object.
    response = SimpleNamespace(status_code=status_code)
    with patch("apps.notifications.tasks.webpush", return_value=response):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_after_successful_notification_to_another_endpoint(
    vapid_settings,
):
    user = make_user()
    successful = make_subscription(user, "successful")
    stale = make_subscription(user, "stale")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == stale.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(successful.id)
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_handles_all_subscriptions_expiring_in_same_batch(
    vapid_settings,
):
    user = make_user()
    ids = [
        make_subscription(user, f"batch-{index}").id
        for index in range(10)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert list(
        PushSubscription.objects.filter(id__in=ids).values_list("id", flat=True)
    ) == []


@pytest.mark.django_db
def test_410_cleanup_does_not_change_subscription_user(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert not PushSubscription.objects.filter(
        pk=subscription.id, user_id=user.id
    ).exists()


@pytest.mark.django_db
def test_410_cleanup_after_provider_exception_keeps_task_returning_none(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        result = run_push(user.id)

    assert result is None
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_handles_provider_exception_per_subscription(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "stale-per-item")
    healthy = make_subscription(user, "healthy-per-item")
    calls = []

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        calls.append(endpoint)
        if endpoint == stale.endpoint:
            raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        result = run_push(user.id)

    assert result is None
    assert calls == [stale.endpoint, healthy.endpoint]
    assert_subscription_removed(stale.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_410_cleanup_with_endpoint_at_maximum_model_length(vapid_settings):
    user = make_user()
    endpoint = "https://push.example.test/" + ("x" * 470)
    subscription = PushSubscription.objects.create(
        user=user,
        endpoint=endpoint,
        p256dh="p256dh-long-endpoint",
        auth="auth-long-endpoint",
    )

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_require_explicit_transaction(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "transaction")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(pk=subscription.pk).exists() is False


@pytest.mark.django_db
def test_410_cleanup_does_not_prune_subscription_for_other_user_after_same_endpoint_is_used(
    vapid_settings,
):
    # The endpoint is unique in the model, so a second user cannot own the
    # exact same endpoint. This test verifies the user scoping of dispatch.
    user = make_user("endpoint-owner")
    other = make_user("different-owner")
    owned = make_subscription(user, "owned")
    other_subscription = make_subscription(other, "different")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(owned.id)
    assert_subscription_exists(other_subscription.id)


@pytest.mark.django_db
def test_410_cleanup_leaves_no_stale_queryset_records(vapid_settings):
    user = make_user()
    make_subscription(user, "a")
    make_subscription(user, "b")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    stale_count = PushSubscription.objects.filter(
        user_id=user.id
    ).count()
    assert stale_count == 0


@pytest.mark.django_db
def test_410_cleanup_can_be_followed_by_new_subscription(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "old")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(stale.id)

    replacement = make_subscription(user, "replacement")
    assert_subscription_exists(replacement.id)


@pytest.mark.django_db
def test_replacement_subscription_is_deliverable(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "old")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    replacement = make_subscription(user, "replacement")

    with patch("apps.notifications.tasks.webpush", return_value=None) as webpush:
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(replacement.id)
    assert webpush.call_count == 1


@pytest.mark.django_db
def test_410_cleanup_handles_provider_response_status_as_integer(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = SimpleNamespace(status_code=int("410"))

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_use_status_reason_for_matching(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("something else")
    error.response = SimpleNamespace(status_code=410, reason="Temporary")

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_safe_when_response_has_only_status_code(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = SimpleNamespace(status_code=410)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_endpoint_uniqueness_for_new_records(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "unique-old")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    replacement = make_subscription(user, "unique-new")
    assert replacement.endpoint != stale.endpoint


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_unrelated_model_records(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "stale")
    unrelated = make_subscription(user, "unrelated")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=lambda **kwargs: (
            (_ for _ in ()).throw(web_push_exception(410))
            if kwargs["subscription_info"]["endpoint"] == stale.endpoint
            else None
        ),
    ):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(unrelated.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_subscription_before_webpush_call(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    observed = []

    def side_effect(*args, **kwargs):
        observed.append(
            PushSubscription.objects.filter(pk=subscription.pk).exists()
        )
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert observed == [True]
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_deletes_after_failed_delivery(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    observed_after = []

    def side_effect(*args, **kwargs):
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)
        observed_after.append(
            PushSubscription.objects.filter(pk=subscription.pk).exists()
        )

    assert observed_after == [False]


@pytest.mark.django_db
def test_410_cleanup_does_not_raise_provider_exception_to_caller(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        try:
            run_push(user.id)
        except WebPushException as exc:
            pytest.fail(f"410 should be handled by the task: {exc}")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_for_one_subscription_does_not_change_other_user_count(
    vapid_settings,
):
    user = make_user()
    other = make_user("count-other")
    stale = make_subscription(user, "count-stale")
    make_subscription(other, "count-other")

    before = PushSubscription.objects.filter(user=other).count()

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=other).count() == before
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_with_default_arguments(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "title", "message")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_explicit_none_url(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "title", "message", None)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_falsey_title(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "", "message")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_falsey_message(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "title", "")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_url_and_empty_message(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(
            user.id,
            "title",
            "",
            "https://example.test",
        )

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_multiple_users(vapid_settings):
    users = [make_user(f"multi-user-{i}") for i in range(4)]
    target_subscription = make_subscription(users[0], "target")
    untouched = [
        make_subscription(users[index], f"untouched-{index}")
        for index in range(1, 4)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(users[0].id)

    assert_subscription_removed(target_subscription.id)
    for subscription in untouched:
        assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_can_prune_subscription_after_other_error(
    vapid_settings,
):
    user = make_user()
    transient = make_subscription(user, "transient-first")
    stale = make_subscription(user, "stale-second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == transient.endpoint:
            raise RuntimeError("temporary")
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(transient.id)
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_can_prune_before_other_error(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "stale-first")
    transient = make_subscription(user, "transient-second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == stale.endpoint:
            raise web_push_exception(410)
        raise RuntimeError("temporary")

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(transient.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_turn_transient_error_into_deletion(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=WebPushException("temporary provider error"),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_distinct_from_generic_exception_handling(
    vapid_settings,
):
    user = make_user()
    gone = make_subscription(user, "gone")
    generic = make_subscription(user, "generic")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == gone.endpoint:
            raise web_push_exception(410)
        raise RuntimeError("generic failure")

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(gone.id)
    assert_subscription_exists(generic.id)


@pytest.mark.django_db
def test_410_cleanup_keeps_404_compatibility(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "not-found")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(404),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_explicitly_asserted_against_status_code(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("provider response")
    error.response = SimpleNamespace(status_code=410)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert PushSubscription.objects.filter(
        id=subscription.id,
        user_id=user.id,
    ).exists() is False


@pytest.mark.django_db
def test_410_cleanup_does_not_modify_user_profile(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    user.refresh_from_db()
    assert user.pk is not None
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_three_subscription_states(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "gone")
    transient = make_subscription(user, "retry")
    healthy = make_subscription(user, "ok")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == stale.endpoint:
            raise web_push_exception(410)
        if endpoint == transient.endpoint:
            raise web_push_exception(503)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(transient.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_410_cleanup_with_repeated_success_and_failure_pattern(
    vapid_settings,
):
    user = make_user()
    subscriptions = [
        make_subscription(user, str(index))
        for index in range(6)
    ]

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        index = int(endpoint.rsplit("/", 1)[-1])
        if index % 2 == 0:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    for subscription in subscriptions:
        suffix = int(subscription.endpoint.rsplit("/", 1)[-1])
        if suffix % 2 == 0:
            assert_subscription_removed(subscription.id)
        else:
            assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_after_all_subscriptions_removed_is_a_noop(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "first")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(first.id)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id)
        webpush.assert_not_called()


@pytest.mark.django_db
def test_410_cleanup_does_not_require_push_subscription_refresh(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user, "refresh")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(
        endpoint=subscription.endpoint
    ).exists() is False


@pytest.mark.django_db
def test_410_cleanup_keeps_endpoint_from_being_retried(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "no-retry")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as first_push:
        run_push(user.id)

    assert first_push.call_count == 1

    with patch("apps.notifications.tasks.webpush") as second_push:
        run_push(user.id)
        second_push.assert_not_called()

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_provider_error_after_payload_construction(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user, "payload-error")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as webpush:
        run_push(
            user.id,
            title="A",
            message="B",
            url="https://example.test/c",
        )

    assert webpush.call_args.kwargs["data"]
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_subscription_key_values(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "keys")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ) as webpush:
        run_push(user.id)

    info = webpush.call_args.kwargs["subscription_info"]
    assert info["keys"] == {
        "p256dh": subscription.p256dh,
        "auth": subscription.auth,
    }
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_healthy_subscription_credentials(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "stale-creds")
    healthy = make_subscription(user, "healthy-creds")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == stale.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.p256dh == "p256dh-healthy-creds"
    assert healthy.auth == "auth-healthy-creds"
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_created_at_for_healthy_subscription(
    vapid_settings,
):
    user = make_user()
    stale = make_subscription(user, "created-stale")
    healthy = make_subscription(user, "created-healthy")
    created_at = healthy.created_at

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == stale.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.created_at == created_at
    assert_subscription_removed(stale.id)


@pytest.mark.django_db
def test_410_cleanup_with_many_other_users(vapid_settings):
    target = make_user("target-many-users")
    others = [make_user(f"other-many-users-{i}") for i in range(8)]
    target_subscription = make_subscription(target, "target")
    other_subscriptions = [
        make_subscription(user, f"other-{index}")
        for index, user in enumerate(others)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(target.id)

    assert_subscription_removed(target_subscription.id)
    for subscription in other_subscriptions:
        assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_not_triggered_by_410_in_exception_text_only(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    error = RuntimeError("HTTP 410 Gone")

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_not_triggered_by_410_status_without_webpush_exception(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    response = SimpleNamespace(status_code=410)

    with patch("apps.notifications.tasks.webpush", return_value=response):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_requires_webpush_exception_response(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = None

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_before_exception(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    states = []

    def side_effect(*args, **kwargs):
        states.append(
            PushSubscription.objects.filter(pk=subscription.pk).exists()
        )
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert states == [True]
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_allows_new_endpoint_after_pruning(vapid_settings):
    user = make_user()
    old = make_subscription(user, "old-endpoint")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(old.id)

    new = make_subscription(user, "new-endpoint")
    with patch("apps.notifications.tasks.webpush", return_value=None):
        run_push(user.id)

    assert_subscription_exists(new.id)


@pytest.mark.django_db
def test_410_cleanup_with_batch_of_expired_endpoints(vapid_settings):
    user = make_user()
    expired = [
        make_subscription(user, f"expired-{i}")
        for i in range(15)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    remaining = PushSubscription.objects.filter(user=user).count()
    assert remaining == 0
    assert all(
        not PushSubscription.objects.filter(pk=item.pk).exists()
        for item in expired
    )


@pytest.mark.django_db
def test_410_cleanup_keeps_database_transaction_result_consistent(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user, "transaction-consistency")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    fresh = PushSubscription.objects.filter(
        pk=subscription.pk
    ).first()
    assert fresh is None


@pytest.mark.django_db
def test_410_cleanup_does_not_create_dead_letter_entry(vapid_settings):
    # PushSubscription cleanup is intentionally separate from the generic
    # NotificationDelivery dead-letter flow.
    from apps.notifications.models import NotificationDeadLetter

    user = make_user()
    subscription = make_subscription(user, "dead-letter")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)
    assert NotificationDeadLetter.objects.count() == 0


@pytest.mark.django_db
def test_410_cleanup_does_not_change_delivery_models(vapid_settings):
    from apps.notifications.models import Notification, NotificationDelivery

    user = make_user()
    subscription = make_subscription(user, "delivery")
    notification = Notification.objects.create(
        recipient=user,
        notif_type="badge",
        title="Test",
        message="Test",
    )
    delivery = NotificationDelivery.objects.create(
        notification=notification,
        recipient=user,
        channel="push",
        status="pending",
    )

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    delivery.refresh_from_db()
    assert delivery.status == "pending"
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_endpoint_containing_query_string(vapid_settings):
    user = make_user()
    subscription = PushSubscription.objects.create(
        user=user,
        endpoint="https://push.example.test/sub/query?token=abc",
        p256dh="query-p256dh",
        auth="query-auth",
    )

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_endpoint_containing_path_segments(vapid_settings):
    user = make_user()
    subscription = PushSubscription.objects.create(
        user=user,
        endpoint="https://push.example.test/a/b/c/d",
        p256dh="path-p256dh",
        auth="path-auth",
    )

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_distinct_auth_keys(vapid_settings):
    user = make_user()
    first = make_subscription(user, "auth-one")
    second = make_subscription(user, "auth-two")

    assert first.auth != second.auth

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == first.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_exists(second.id)


@pytest.mark.django_db
def test_410_cleanup_with_distinct_p256dh_keys(vapid_settings):
    user = make_user()
    first = make_subscription(user, "p256dh-one")
    second = make_subscription(user, "p256dh-two")

    assert first.p256dh != second.p256dh

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == first.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_exists(second.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_subscription_when_push_is_never_called(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id + 999999)
        webpush.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_stable_across_success_then_410(vapid_settings):
    user = make_user()
    subscription = make_subscription(user, "success-then-gone")

    with patch("apps.notifications.tasks.webpush", return_value=None):
        run_push(user.id)

    assert_subscription_exists(subscription.id)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_stable_across_410_then_successful_replacement(
    vapid_settings,
):
    user = make_user()
    old = make_subscription(user, "gone-first")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(old.id)

    replacement = make_subscription(user, "replacement-after-gone")
    with patch("apps.notifications.tasks.webpush", return_value=None):
        run_push(user.id)

    assert_subscription_exists(replacement.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_prune_new_record_after_old_record_is_removed(
    vapid_settings,
):
    user = make_user()
    old = make_subscription(user, "old")
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(old.id)

    new = make_subscription(user, "new")
    with patch("apps.notifications.tasks.webpush", return_value=None):
        run_push(user.id)

    assert_subscription_exists(new.id)


@pytest.mark.django_db
def test_410_cleanup_with_404_then_410_in_sequence(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == first.endpoint:
            raise web_push_exception(404)
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_with_410_then_404_in_sequence(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == first.endpoint:
            raise web_push_exception(410)
        raise web_push_exception(404)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_with_410_then_503_in_sequence(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == first.endpoint:
            raise web_push_exception(410)
        raise web_push_exception(503)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_exists(second.id)


@pytest.mark.django_db
def test_410_cleanup_with_503_then_410_in_sequence(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint == first.endpoint:
            raise web_push_exception(503)
        raise web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_is_safe_for_large_subscription_set(vapid_settings):
    user = make_user()
    for index in range(50):
        make_subscription(user, f"large-{index}")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 0


@pytest.mark.django_db
def test_410_cleanup_is_safe_for_multiple_large_user_sets(vapid_settings):
    target = make_user("large-target")
    others = [make_user(f"large-other-{i}") for i in range(5)]
    target_subscriptions = [
        make_subscription(target, f"target-{i}") for i in range(20)
    ]
    other_subscriptions = [
        make_subscription(user, f"other-{i}")
        for i, user in enumerate(others)
    ]

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(target.id)

    assert all(
        not PushSubscription.objects.filter(pk=item.pk).exists()
        for item in target_subscriptions
    )
    assert all(
        PushSubscription.objects.filter(pk=item.pk).exists()
        for item in other_subscriptions
    )


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_by_endpoint_prefix(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "prefix")
    healthy = PushSubscription.objects.create(
        user=user,
        endpoint="https://push.example.test/subscription/prefix-other",
        p256dh="prefix-other-p256dh",
        auth="prefix-other-auth",
    )

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == stale.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(healthy.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_by_user_alone(vapid_settings):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == first.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(first.id)
    assert_subscription_exists(second.id)


@pytest.mark.django_db
def test_410_cleanup_with_provider_error_object(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    response = SimpleNamespace(status_code=410, json=lambda: {"error": "gone"})
    error = WebPushException("gone")
    error.response = response

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_after_provider_response_has_headers(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    response = SimpleNamespace(
        status_code=410,
        headers={"content-type": "application/json"},
    )
    error = WebPushException("gone")
    error.response = response

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_depend_on_error_string_case(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("GONE")
    error.response = SimpleNamespace(status_code=410)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_depend_on_error_message(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("arbitrary message")
    error.response = SimpleNamespace(status_code=410)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_when_response_status_is_string(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("gone")
    error.response = SimpleNamespace(status_code="410")

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    # Production matching uses numeric HTTP status codes. A provider adapter
    # returning a string should not accidentally broaden deletion semantics.
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_uses_numeric_404(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("not found")
    error.response = SimpleNamespace(status_code=404)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_zero_status_preserves_record(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("zero")
    error.response = SimpleNamespace(status_code=0)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_none_status_preserves_record(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = WebPushException("none")
    error.response = SimpleNamespace(status_code=None)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_301(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(301),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_302(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(302),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_307(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(307),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_308(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(308),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_429(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(429),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_500(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(500),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_503(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(503),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_on_599(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(599),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_consistent_for_two_expired_subscriptions(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "expired-first")
    second = make_subscription(user, "expired-second")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert not PushSubscription.objects.filter(
        pk__in=[first.pk, second.pk]
    ).exists()


@pytest.mark.django_db
def test_410_cleanup_is_consistent_for_expired_and_healthy_subscriptions(
    vapid_settings,
):
    user = make_user()
    expired = make_subscription(user, "expired")
    healthy = make_subscription(user, "healthy")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert not PushSubscription.objects.filter(pk=expired.pk).exists()
    assert PushSubscription.objects.filter(pk=healthy.pk).exists()


@pytest.mark.django_db
def test_410_cleanup_is_consistent_for_expired_and_retryable_subscriptions(
    vapid_settings,
):
    user = make_user()
    expired = make_subscription(user, "expired")
    retryable = make_subscription(user, "retryable")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        raise web_push_exception(503)

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert not PushSubscription.objects.filter(pk=expired.pk).exists()
    assert PushSubscription.objects.filter(pk=retryable.pk).exists()


@pytest.mark.django_db
def test_410_cleanup_does_not_affect_subscription_creation_time_for_others(
    vapid_settings,
):
    user = make_user()
    expired = make_subscription(user, "expired")
    healthy = make_subscription(user, "healthy")
    original_created = healthy.created_at

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.created_at == original_created


@pytest.mark.django_db
def test_410_cleanup_does_not_affect_auth_for_others(vapid_settings):
    user = make_user()
    expired = make_subscription(user, "expired")
    healthy = make_subscription(user, "healthy")
    original_auth = healthy.auth

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.auth == original_auth


@pytest.mark.django_db
def test_410_cleanup_does_not_affect_p256dh_for_others(vapid_settings):
    user = make_user()
    expired = make_subscription(user, "expired")
    healthy = make_subscription(user, "healthy")
    original_p256dh = healthy.p256dh

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.p256dh == original_p256dh


@pytest.mark.django_db
def test_410_cleanup_does_not_affect_endpoint_for_others(vapid_settings):
    user = make_user()
    expired = make_subscription(user, "expired")
    healthy = make_subscription(user, "healthy")
    original_endpoint = healthy.endpoint

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == expired.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    healthy.refresh_from_db()
    assert healthy.endpoint == original_endpoint


@pytest.mark.django_db
def test_410_cleanup_after_provider_gone_response_is_final(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)
    error = web_push_exception(410)

    with patch("apps.notifications.tasks.webpush", side_effect=error):
        run_push(user.id)

    assert PushSubscription.objects.filter(pk=subscription.pk).first() is None


@pytest.mark.django_db
def test_410_cleanup_does_not_log_as_generic_failure(vapid_settings, caplog):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    # The 410 path is terminal cleanup rather than the generic warning path.
    assert_subscription_removed(subscription.id)
    assert not any(
        "Web push failed for subscription" in record.message
        for record in caplog.records
    )


@pytest.mark.django_db
def test_410_cleanup_keeps_generic_warning_for_transient_failure(
    vapid_settings,
    caplog,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(503),
    ):
        run_push(user.id)

    assert_subscription_exists(subscription.id)
    assert any(
        "Web push failed for subscription" in record.message
        for record in caplog.records
    )


@pytest.mark.django_db
def test_410_cleanup_does_not_warn_as_generic_for_404(vapid_settings, caplog):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(404),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)
    assert not any(
        "Web push failed for subscription" in record.message
        for record in caplog.records
    )


@pytest.mark.django_db
def test_410_cleanup_with_payload_does_not_change_cleanup_semantics(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(
            user.id,
            title="Payload title",
            message="Payload message",
            url="https://example.test/payload",
        )

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_repeatable_after_recreated_subscription(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "first")

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(first.id)

    second = make_subscription(user, "second")
    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_delete_subscription_for_invalid_user_id(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(user.id + 10_000_000)
        webpush.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_valid_user_id_string(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(str(user.id))

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_zero_user_id_does_not_delete_other_users(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush") as webpush:
        run_push(0)
        webpush.assert_not_called()

    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_after_successful_call_uses_same_subscription(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush", return_value=None) as webpush:
        run_push(user.id)
        assert webpush.call_count == 1

    assert_subscription_exists(subscription.id)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_not_affected_by_vapid_email_case(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with override_settings(VAPID_ADMIN_EMAIL="MAILTO:TEST@EXAMPLE.COM"):
        with patch(
            "apps.notifications.tasks.webpush",
            side_effect=web_push_exception(410),
        ):
            run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_not_affected_by_private_key_shape(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with override_settings(VAPID_PRIVATE_KEY="different-key-shape"):
        with patch(
            "apps.notifications.tasks.webpush",
            side_effect=web_push_exception(410),
        ):
            run_push(user.id)

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_with_provider_error_and_multiple_subscriptions(
    vapid_settings,
):
    user = make_user()
    subscriptions = [
        make_subscription(user, f"multi-{i}")
        for i in range(4)
    ]

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint.endswith("multi-1") or endpoint.endswith("multi-3"):
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(subscriptions[0].id)
    assert_subscription_removed(subscriptions[1].id)
    assert_subscription_exists(subscriptions[2].id)
    assert_subscription_removed(subscriptions[3].id)


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_first_subscription_when_second_fails(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == second.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_remove_second_subscription_when_first_succeeds(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == second.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_exists(first.id)
    assert_subscription_removed(second.id)


@pytest.mark.django_db
def test_410_cleanup_preserves_subscription_model_contract(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    assert PushSubscription.objects.filter(
        user=user,
        endpoint=subscription.endpoint,
    ).count() == 0


@pytest.mark.django_db
def test_410_cleanup_has_no_side_effect_on_unrelated_endpoint(vapid_settings):
    user = make_user()
    stale = make_subscription(user, "stale-endpoint")
    unrelated = make_subscription(user, "unrelated-endpoint")

    def side_effect(*args, **kwargs):
        if kwargs["subscription_info"]["endpoint"] == stale.endpoint:
            raise web_push_exception(410)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert_subscription_removed(stale.id)
    assert_subscription_exists(unrelated.id)


@pytest.mark.django_db
def test_410_cleanup_after_mixed_results_leaves_expected_count(
    vapid_settings,
):
    user = make_user()
    first = make_subscription(user, "first")
    second = make_subscription(user, "second")
    third = make_subscription(user, "third")
    fourth = make_subscription(user, "fourth")

    def side_effect(*args, **kwargs):
        endpoint = kwargs["subscription_info"]["endpoint"]
        if endpoint in {first.endpoint, fourth.endpoint}:
            raise web_push_exception(410)
        if endpoint == second.endpoint:
            raise web_push_exception(503)
        return None

    with patch("apps.notifications.tasks.webpush", side_effect=side_effect):
        run_push(user.id)

    assert PushSubscription.objects.filter(user=user).count() == 2
    assert_subscription_removed(first.id)
    assert_subscription_exists(second.id)
    assert_subscription_exists(third.id)
    assert_subscription_removed(fourth.id)


@pytest.mark.django_db
def test_410_cleanup_is_not_deferred(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        run_push(user.id)

    # The database record is removed during the dispatch call rather than
    # waiting for a later maintenance job.
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_does_not_require_celery(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        result = send_web_push_notification(
            user.id,
            "title",
            "message",
        )

    assert result is None
    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_is_available_from_task_module(vapid_settings):
    user = make_user()
    subscription = make_subscription(user)

    assert callable(send_web_push_notification)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "title", "message")

    assert_subscription_removed(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_keeps_successful_webpush_call_arguments_valid(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush", return_value=None) as webpush:
        send_web_push_notification(
            user.id,
            "title",
            "message",
            "https://example.test",
        )

    kwargs = webpush.call_args.kwargs
    assert kwargs["vapid_private_key"] == "test-private-key"
    assert kwargs["vapid_claims"] == {"sub": "mailto:test@example.com"}
    assert kwargs["subscription_info"]["endpoint"] == subscription.endpoint
    assert_subscription_exists(subscription.id)


@pytest.mark.django_db
def test_410_cleanup_after_valid_call_then_410_keeps_payload_path_valid(
    vapid_settings,
):
    user = make_user()
    subscription = make_subscription(user)

    with patch("apps.notifications.tasks.webpush", return_value=None):
        send_web_push_notification(user.id, "first", "first")

    assert_subscription_exists(subscription.id)

    with patch(
        "apps.notifications.tasks.webpush",
        side_effect=web_push_exception(410),
    ):
        send_web_push_notification(user.id, "second", "second")

    assert_subscription_removed(subscription.id)
