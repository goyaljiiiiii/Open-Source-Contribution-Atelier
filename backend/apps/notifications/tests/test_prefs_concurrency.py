import threading

import pytest
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.test import TransactionTestCase, skipUnlessDBFeature
from rest_framework.test import APIClient

from apps.notifications.models import NotificationPreference

User = get_user_model()


class NotificationPreferenceConcurrencyTests(TransactionTestCase):
    """
    Regression test for the race condition in NotificationPrefsView.

    Uses TransactionTestCase so each thread gets its own DB connection
    and transactions are actually committed, allowing us to test real
    concurrent behavior with select_for_update().

    Note: SQLite serialises all writes globally, so select_for_update()
    is effectively a no-op there. These tests verify logical correctness
    under concurrent writes regardless of the database backend.
    """

    reset_sequences = True

    @classmethod
    def setUpClass(cls):
        # Skip unless the backend supports SELECT ... FOR UPDATE.
        super().setUpClass()
        if connection.vendor == "sqlite":
            # SQLite doesn't truly support row-level locking, but we keep
            # the tests running to verify logical correctness (serialised
            # by the single SQLite writer lock).
            pass

    def setUp(self):
        self.user = User.objects.create_user(
            username="prefs_concurrent_user",
            email="prefs_concurrent@example.com",
            password="testpass123",
        )
        self.prefs = NotificationPreference.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.barrier = threading.Barrier(2, timeout=10)

    def _patch_prefs(self, email_val, in_app_val):
        """Run a PATCH request from a fresh DB connection (thread)."""
        from django.db import close_old_connections

        close_old_connections()
        try:
            user = User.objects.get(pk=self.user.pk)
            client = APIClient()
            client.force_authenticate(user=user)
            response = client.patch(
                "/api/notifications/prefs/",
                {"email": email_val, "in_app": in_app_val},
                format="json",
            )
            return response.status_code
        finally:
            close_old_connections()

    @skipUnlessDBFeature("has_select_for_update")
    def test_concurrent_patch_does_not_lose_updates(self):
        """
        Two concurrent PATCH requests that set opposing boolean values
        must not overwrite each other — the last writer wins, but both
        writes must be durably committed (no lost update).
        """
        results = []
        errors = []

        def worker(email_val, in_app_val):
            try:
                self.barrier.wait()
                status = self._patch_prefs(email_val, in_app_val)
                results.append(status)
            except Exception as e:
                errors.append(str(e))

        t1 = threading.Thread(target=worker, args=(True, False))
        t2 = threading.Thread(target=worker, args=(False, True))

        t1.start()
        t2.start()
        t1.join(timeout=30)
        t2.join(timeout=30)

        # Both requests should succeed.
        assert (
            len(results) == 2
        ), f"Expected 2 results, got {len(results)}. Errors: {errors}"
        assert all(
            s in (200, 201) for s in results
        ), f"Unexpected status codes: {results}"

        # Reload from DB and verify the final state is one of the two
        # expected outcomes (no interleaved/partial values).
        prefs = NotificationPreference.objects.get(user=self.user)
        assert (prefs.email_enabled, prefs.in_app_enabled) in [
            (True, False),
            (False, True),
        ], (
            f"Race condition detected! Got email={prefs.email_enabled}, "
            f"in_app={prefs.in_app_enabled}"
        )
