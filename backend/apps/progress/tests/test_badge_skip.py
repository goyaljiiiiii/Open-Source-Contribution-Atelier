import logging
import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.core.cache import multi_level_cache as cache
from apps.progress.models import Badge, UserBadge
from apps.progress.tasks import (
    award_badge_to_users,
    award_specific_badge,
    evaluate_achievements_task,
)

User = get_user_model()


@pytest.mark.django_db
class TestBadgeSkipLoggingAndMetrics(TestCase):
    def setUp(self):
        cache.delete("badge_issuance_skipped_total")
        self.valid_user = User.objects.create_user(
            username="badge_test_user", email="badge@example.com", password="password"
        )
        self.valid_badge = Badge.objects.create(
            name="Test Badge", slug="test-badge-skip", description="Test badge description"
        )

    def test_award_specific_badge_missing_user_logs_warning_and_increments_metric(self):
        non_existent_user_id = 99999

        with self.assertLogs("apps.progress.tasks", level="WARNING") as cm:
            award_specific_badge(user_id=non_existent_user_id, badge_id=self.valid_badge.id)

        self.assertTrue(
            any("Skipping badge award: Recipient user id=99999 not found" in log for log in cm.output)
        )
        skipped_metric = cache.get("badge_issuance_skipped_total")
        self.assertIsNotNone(skipped_metric)
        self.assertGreaterEqual(skipped_metric, 1)

    def test_award_specific_badge_missing_badge_logs_warning_and_increments_metric(self):
        non_existent_badge_id = 88888

        with self.assertLogs("apps.progress.tasks", level="WARNING") as cm:
            award_specific_badge(user_id=self.valid_user.id, badge_id=non_existent_badge_id)

        self.assertTrue(
            any("Skipping badge award: Badge id=88888 not found" in log for log in cm.output)
        )

    def test_evaluate_achievements_missing_user_logs_warning(self):
        non_existent_user_id = 77777

        with self.assertLogs("apps.progress.tasks", level="WARNING") as cm:
            evaluate_achievements_task(user_id=non_existent_user_id)

        self.assertTrue(
            any("Skipping achievement evaluation: Recipient user id=77777 not found" in log for log in cm.output)
        )

    def test_award_badge_to_users_bulk_handles_missing_recipients(self):
        missing_user_id = 55555
        user_ids = [self.valid_user.id, missing_user_id]

        with self.assertLogs("apps.progress.tasks", level="WARNING") as cm:
            res = award_badge_to_users(user_ids=user_ids, badge_id=self.valid_badge.id)

        self.assertEqual(res["awarded"], 1)
        self.assertEqual(res["skipped"], 1)
        self.assertTrue(UserBadge.objects.filter(user=self.valid_user, badge=self.valid_badge).exists())
        self.assertTrue(
            any("Skipping badge award for recipient user_id=55555" in log for log in cm.output)
        )
