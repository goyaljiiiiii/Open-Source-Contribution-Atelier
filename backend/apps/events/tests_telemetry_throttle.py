import time

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.events.models import DomainEvent
from apps.events.services.event_bus import EventBus

User = get_user_model()


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="telemetry_test_user",
        email="telemetry@example.com",
        password="ValidPassword123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="other_telemetry_user",
        email="other_telemetry@example.com",
        password="ValidPassword123!",
    )


@pytest.mark.django_db
class TestEventBusTelemetryThrottling:
    def test_duplicate_event_throttled_within_500ms(self, user):
        payload = {"action": "scroll_lesson", "offset_y": 450}

        # First event emit should succeed
        ev1 = EventBus.emit(
            "client.telemetry.scroll",
            data=payload,
            actor=user,
            throttle_window_ms=500,
        )
        assert ev1 is not None
        assert isinstance(ev1, DomainEvent)

        # Immediate duplicate emit with identical payload and actor should be throttled
        ev2 = EventBus.emit(
            "client.telemetry.scroll",
            data=payload,
            actor=user,
            throttle_window_ms=500,
        )
        assert ev2 is None

    def test_different_payload_not_throttled(self, user):
        ev1 = EventBus.emit(
            "client.telemetry.click",
            data={"target": "button_a"},
            actor=user,
            throttle_window_ms=500,
        )
        ev2 = EventBus.emit(
            "client.telemetry.click",
            data={"target": "button_b"},
            actor=user,
            throttle_window_ms=500,
        )
        assert ev1 is not None
        assert ev2 is not None
        assert ev1.id != ev2.id

    def test_different_actor_not_throttled(self, user, other_user):
        payload = {"screen": "dashboard"}
        ev1 = EventBus.emit(
            "client.telemetry.view",
            data=payload,
            actor=user,
            throttle_window_ms=500,
        )
        ev2 = EventBus.emit(
            "client.telemetry.view",
            data=payload,
            actor=other_user,
            throttle_window_ms=500,
        )
        assert ev1 is not None
        assert ev2 is not None

    def test_throttle_disabled_when_window_zero(self, user):
        payload = {"action": "heartbeat"}
        ev1 = EventBus.emit(
            "client.telemetry.heartbeat",
            data=payload,
            actor=user,
            throttle_window_ms=0,
        )
        ev2 = EventBus.emit(
            "client.telemetry.heartbeat",
            data=payload,
            actor=user,
            throttle_window_ms=0,
        )
        assert ev1 is not None
        assert ev2 is not None

    def test_emit_allowed_after_window_expires(self, user):
        payload = {"action": "quick_event"}
        ev1 = EventBus.emit(
            "client.telemetry.quick",
            data=payload,
            actor=user,
            throttle_window_ms=50,  # 50ms window
        )
        assert ev1 is not None

        time.sleep(0.06)  # 60ms elapsed

        ev2 = EventBus.emit(
            "client.telemetry.quick",
            data=payload,
            actor=user,
            throttle_window_ms=50,
        )
        assert ev2 is not None


@pytest.mark.django_db
class TestTelemetryEventIngestAPI:
    def test_api_ingests_and_throttles_duplicates(self, user):
        from rest_framework.test import APIRequestFactory, force_authenticate

        from apps.events.views import TelemetryEventIngestView

        factory = APIRequestFactory()
        view = TelemetryEventIngestView.as_view()

        payload = {
            "event_type": "ui.interaction.tab_change",
            "data": {"tab": "code_editor"},
        }

        # 1st request -> accepted
        request1 = factory.post("/api/events/telemetry/", data=payload, format="json")
        force_authenticate(request1, user=user)
        resp1 = view(request1)
        assert resp1.status_code == 202
        assert resp1.data["status"] == "accepted"
        assert "event_id" in resp1.data

        # 2nd immediate request -> throttled
        request2 = factory.post("/api/events/telemetry/", data=payload, format="json")
        force_authenticate(request2, user=user)
        resp2 = view(request2)
        assert resp2.status_code == 200
        assert resp2.data["status"] == "throttled"
