"""
Resource-leak regression tests for NotificationConsumer.

The original issue asked for 1000 live connections asserted against a real
Redis ``CLIENT LIST`` baseline. That is not runnable here: the test settings
fall back to InMemoryChannelLayer (see ``config.channel_layers``), so there is
no Redis to count, and 1000 sockets would dominate CI runtime for no extra
signal. These tests assert the invariants that actually catch the leak:

* every accepted connection cancels its heartbeat task on disconnect, so no
  orphaned asyncio task keeps the consumer object alive;
* the active-connection gauge returns to its baseline after churn;
* a client that stops answering pings is force-closed rather than parked
  half-open forever.
"""

import asyncio

import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

from apps.notifications import metrics
from config.asgi import application

User = get_user_model()

HEADERS = [(b"origin", b"http://localhost")]
CHURN_CONNECTIONS = 50


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username="leakuser", password="testpassword123")


@pytest.fixture
def token(auth_user):
    return str(AccessToken.for_user(auth_user))


@pytest.fixture
def fast_heartbeat(settings):
    """Compress the heartbeat so timing tests stay sub-second."""
    settings.NOTIFICATIONS_WS_HEARTBEAT_INTERVAL = 0.05
    settings.NOTIFICATIONS_WS_MAX_MISSED_PONGS = 3
    return settings


def _pending_tasks():
    """Tasks alive in the running loop, excluding the one asking."""
    current = asyncio.current_task()
    return {t for t in asyncio.all_tasks() if t is not current and not t.done()}


async def _connect(token):
    communicator = WebsocketCommunicator(
        application, f"/ws/notifications/?token={token}", headers=HEADERS
    )
    connected, _ = await communicator.connect()
    assert connected
    await communicator.receive_json_from()  # connection_established
    return communicator


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestWebSocketResourceCleanup:
    async def test_disconnect_leaves_no_orphan_tasks(self, token):
        """A connect/disconnect cycle must return the loop to its baseline."""
        baseline = _pending_tasks()

        communicator = await _connect(token)
        assert len(_pending_tasks()) > len(baseline), "heartbeat task never started"

        await communicator.disconnect()
        await asyncio.sleep(0)  # let cancellation settle

        leaked = _pending_tasks() - baseline
        assert not leaked, f"orphaned tasks survived disconnect: {leaked}"

    async def test_connection_churn_does_not_accumulate_tasks(self, token):
        """
        Scaled-down stand-in for the 1000-connection stress test: repeated
        churn must not grow the task set monotonically.
        """
        baseline = _pending_tasks()

        for _ in range(CHURN_CONNECTIONS):
            communicator = await _connect(token)
            await communicator.disconnect()

        await asyncio.sleep(0)
        leaked = _pending_tasks() - baseline
        assert not leaked, f"{len(leaked)} tasks leaked over {CHURN_CONNECTIONS} cycles"

    async def test_active_connection_gauge_returns_to_baseline(self, token):
        """notifications_ws_active_connections must not drift after churn."""
        baseline = metrics.ws_active_connections()
        if baseline is None:
            pytest.skip("prometheus_client not installed")

        communicators = [await _connect(token) for _ in range(5)]
        assert metrics.ws_active_connections() == baseline + 5

        for communicator in communicators:
            await communicator.disconnect()

        assert metrics.ws_active_connections() == baseline

    async def test_rejected_connection_is_not_counted(self):
        """An unauthenticated connect must not touch the gauge."""
        baseline = metrics.ws_active_connections()
        if baseline is None:
            pytest.skip("prometheus_client not installed")

        communicator = WebsocketCommunicator(application, "/ws/notifications/")
        connected, _ = await communicator.connect()
        assert not connected
        await communicator.disconnect()

        assert metrics.ws_active_connections() == baseline


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestHeartbeat:
    async def test_server_pings_idle_client(self, token, fast_heartbeat):
        communicator = await _connect(token)
        try:
            message = await communicator.receive_json_from(timeout=2)
            assert message["type"] == "ping"
        finally:
            await communicator.disconnect()

    async def test_pong_resets_missed_counter(self, token, fast_heartbeat):
        """Answering pings keeps the socket open past the miss threshold."""
        communicator = await _connect(token)
        try:
            for _ in range(5):
                message = await communicator.receive_json_from(timeout=2)
                assert message["type"] == "ping"
                await communicator.send_json_to({"action": "pong"})
        finally:
            await communicator.disconnect()

    async def test_client_ping_gets_pong(self, token):
        communicator = await _connect(token)
        try:
            await communicator.send_json_to({"action": "ping"})
            message = await communicator.receive_json_from(timeout=2)
            assert message["type"] == "pong"
        finally:
            await communicator.disconnect()

    async def test_silent_client_is_closed(self, token, fast_heartbeat):
        """Three unanswered pings must force-close the socket."""
        communicator = await _connect(token)
        try:
            for _ in range(30):
                event = await communicator.receive_output(timeout=2)
                if event["type"] == "websocket.close":
                    assert event.get("code") == 4002
                    return
            pytest.fail("socket stayed open despite unanswered pings")
        finally:
            await communicator.disconnect()
