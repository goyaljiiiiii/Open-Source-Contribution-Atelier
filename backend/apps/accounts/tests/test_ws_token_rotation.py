import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.consumers import JWTTokenRotationConsumer
from apps.accounts.token_rotation import token_event_channel

User = get_user_model()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_valid_jwt_connects_and_subscribes():
    user = await User.objects.acreate(username="ws-rotation-user")
    token = AccessToken.for_user(user)

    redis_client = MagicMock()
    redis_client.pubsub.return_value.subscribe = AsyncMock()
    redis_client.pubsub.return_value.get_message = AsyncMock(
        side_effect=[asyncio.CancelledError()]
    )

    with patch("redis.asyncio.from_url", return_value=redis_client):
        communicator = WebsocketCommunicator(
            JWTTokenRotationConsumer.as_asgi(),
            "/ws/auth/session/",
            subprotocols=["token", str(token)],
        )
        connected, _ = await communicator.connect()
        assert connected
        assert redis_client.pubsub.return_value.subscribe.await_args.args == (
            token_event_channel(user.pk),
        )
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_revoked_event_closes_with_4001():
    user = await User.objects.acreate(username="ws-revoked-user")
    token = AccessToken.for_user(user)

    pubsub = MagicMock()
    pubsub.subscribe = AsyncMock()
    pubsub.get_message = AsyncMock(
        side_effect=[
            {"type": "message", "data": json.dumps({"type": "token_revoked"})}
        ]
    )
    pubsub.unsubscribe = AsyncMock()
    pubsub.close = AsyncMock()

    redis_client = MagicMock()
    redis_client.pubsub.return_value = pubsub
    redis_client.close = AsyncMock()

    with patch("redis.asyncio.from_url", return_value=redis_client):
        communicator = WebsocketCommunicator(
            JWTTokenRotationConsumer.as_asgi(),
            "/ws/auth/session/",
            subprotocols=["token", str(token)],
        )
        connected, _ = await communicator.connect()
        assert connected
        closed = await communicator.receive_output(timeout=1)
        assert closed["type"] == "websocket.close"
        assert closed["code"] == 4001
        await communicator.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_refreshed_event_with_new_jti_closes_with_4001():
    user = await User.objects.acreate(username="ws-refresh-user")
    token = AccessToken.for_user(user)

    pubsub = MagicMock()
    pubsub.subscribe = AsyncMock()
    pubsub.get_message = AsyncMock(
        side_effect=[
            {"type": "message", "data": json.dumps(
                {"type": "token_refreshed", "jti": "different-jti"}
            )}
        ]
    )
    pubsub.unsubscribe = AsyncMock()
    pubsub.close = AsyncMock()

    redis_client = MagicMock()
    redis_client.pubsub.return_value = pubsub
    redis_client.close = AsyncMock()

    with patch("redis.asyncio.from_url", return_value=redis_client):
        communicator = WebsocketCommunicator(
            JWTTokenRotationConsumer.as_asgi(),
            "/ws/auth/session/",
            subprotocols=["token", str(token)],
        )
        connected, _ = await communicator.connect()
        assert connected
        closed = await communicator.receive_output(timeout=1)
        assert closed["type"] == "websocket.close"
        assert closed["code"] == 4001
        await communicator.disconnect()
