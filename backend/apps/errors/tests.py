from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.errors.grouping import calculate_fingerprint, normalize_message
from apps.errors.models import ErrorEvent, ErrorGroup
from apps.errors.tasks import ingest_error_event_task


class NormalizationTests(TestCase):
    def test_normalize_ips(self):
        msg1 = "Connection refused to 127.0.0.1:6379"
        msg2 = "Connection refused to 10.0.0.1:6379"
        self.assertEqual(normalize_message(msg1), "Connection refused to <IP>:6379")
        self.assertEqual(normalize_message(msg2), "Connection refused to <IP>:6379")

        # IPv6
        self.assertEqual(
            normalize_message(
                "Failed to connect to 2001:db8:3333:4444:5555:6666:7777:8888"
            ),
            "Failed to connect to <IP>",
        )

    def test_normalize_uuids(self):
        msg = "Resource 123e4567-e89b-12d3-a456-426614174000 not found"
        self.assertEqual(normalize_message(msg), "Resource <UUID> not found")

    def test_normalize_emails(self):
        msg = "Failed verification for user.name+test@example.com"
        self.assertEqual(normalize_message(msg), "Failed verification for <EMAIL>")

    def test_normalize_timestamps(self):
        msg1 = "Error occurred at 2026-07-16T14:30:00Z"
        msg2 = "Error occurred at 2026-07-16 14:30:00.123456+05:30"
        self.assertEqual(normalize_message(msg1), "Error occurred at <TIMESTAMP>")
        self.assertEqual(normalize_message(msg2), "Error occurred at <TIMESTAMP>")

    def test_normalize_user_ids(self):
        self.assertEqual(
            normalize_message("Failed for user_id=123"), "Failed for <USER_ID>"
        )
        self.assertEqual(
            normalize_message("Failed for User #456"), "Failed for <USER_ID>"
        )
        self.assertEqual(
            normalize_message("Failed for user/789"), "Failed for <USER_ID>"
        )


class FingerprintTests(TestCase):
    def test_fingerprint_generation(self):
        msg = "Connection refused to 127.0.0.1:6379"
        norm = normalize_message(msg)
        fp = calculate_fingerprint(
            norm, 'Traceback:\n  File "app.py", line 12\n    run()', "redis"
        )

        # Test line number changes do not change fingerprint
        fp_different_line = calculate_fingerprint(
            norm, 'Traceback:\n  File "app.py", line 99\n    run()', "redis"
        )
        self.assertEqual(fp, fp_different_line)


class ErrorIngestionTaskTests(TestCase):
    def test_event_grouping(self):
        payload1 = {
            "message": "Connection refused to 127.0.0.1:6379",
            "module": "redis",
        }
        payload2 = {"message": "Connection refused to 10.0.0.1:6379", "module": "redis"}

        event1_id = ingest_error_event_task(payload1)
        event2_id = ingest_error_event_task(payload2)

        event1 = ErrorEvent.objects.get(id=event1_id)
        event2 = ErrorEvent.objects.get(id=event2_id)

        self.assertEqual(event1.group, event2.group)
        self.assertEqual(event1.group.count, 2)

    def test_resolved_auto_reopen_cooldown(self):
        payload = {"message": "Database is down", "module": "db"}
        event_id = ingest_error_event_task(payload)
        event = ErrorEvent.objects.get(id=event_id)
        group = event.group

        # Resolve group
        group.status = "resolved"
        group.resolved_at = timezone.now()
        group.save()

        # Ingest within 7 days - should NOT reopen
        ingest_error_event_task(payload)
        group.refresh_from_db()
        self.assertEqual(group.status, "resolved")

        # Fake resolved_at to be 8 days ago
        group.resolved_at = timezone.now() - timedelta(days=8)
        group.save()

        # Ingest now - should reopen
        ingest_error_event_task(payload)
        group.refresh_from_db()
        self.assertEqual(group.status, "new")
        self.assertIsNone(group.resolved_at)


class ErrorAPIEndpointTests(APITestCase):
    @patch("apps.errors.views.ingest_error_event_task.delay")
    def test_ingestion_endpoint(self, mock_delay):
        url = reverse("error-ingest")
        payload = {
            "message": "Division by zero",
            "stacktrace": "Traceback...",
            "module": "math",
            "user_id": "42",
        }

        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data, {"status": "queued"})
        mock_delay.assert_called_once_with(payload)


class ErrorMonitoringFilterTests(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.user = User.objects.create_user(
            username="adminuser", password="password123", is_staff=True
        )
        self.client.force_authenticate(user=self.user)

        self.group1 = ErrorGroup.objects.create(
            fingerprint="fp1",
            message="Zero Division Error",
            module="math",
            exception_class="ZeroDivisionError",
        )
        self.group2 = ErrorGroup.objects.create(
            fingerprint="fp2",
            message="Missing dictionary key",
            module="core",
            exception_class="KeyError",
        )
        self.group3 = ErrorGroup.objects.create(
            fingerprint="fp3",
            message="Invalid type passed",
            module="core",
            exception_class="TypeError",
        )

        self.event1 = ErrorEvent.objects.create(
            group=self.group1,
            raw_message="division by zero",
            exception_class="ZeroDivisionError",
        )
        self.event2 = ErrorEvent.objects.create(
            group=self.group2,
            raw_message="key 'foo' not found",
            exception_class="KeyError",
        )

    def test_filter_by_exception_class_exact_case(self):
        url = reverse("error-groups-list")
        response = self.client.get(url, {"exception_class": "ZeroDivisionError"})
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["exception_class"], "ZeroDivisionError")

    def test_filter_by_exception_class_case_insensitive_substring(self):
        url = reverse("error-groups-list")
        # Substring 'err' case-insensitive matching ZeroDivisionError, KeyError, TypeError
        response = self.client.get(url, {"exception_class": "error"})
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 3)

        # Substring 'key' matching KeyError
        response_key = self.client.get(url, {"exception_class": "KEY"})
        self.assertEqual(response_key.status_code, 200)
        results_key = response_key.data.get("results", response_key.data)
        self.assertEqual(len(results_key), 1)
        self.assertEqual(results_key[0]["exception_class"], "KeyError")

    def test_events_filter_by_exception_class(self):
        url = reverse("error-events-list")
        response = self.client.get(url, {"exception_class": "zerodivision"})
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["exception_class"], "ZeroDivisionError")

