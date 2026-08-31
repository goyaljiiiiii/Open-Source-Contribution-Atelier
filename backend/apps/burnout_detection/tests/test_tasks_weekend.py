from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.burnout_detection.models import BurnoutActivityDay, BurnoutSignal
from apps.burnout_detection.tasks import detect_user_burnout_risk


class BurnoutWeekendScheduleTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="burnout-test", password="test-password"
        )

    def _add_days(self, dates, hours=8.0):
        BurnoutActivityDay.objects.bulk_create(
            [
                BurnoutActivityDay(user=self.user, date=date, active_hours=hours)
                for date in dates
            ]
        )

    @patch("apps.burnout_detection.tasks.trigger_intervention.delay")
    def test_weekend_activity_does_not_count_for_non_weekend_learner(self, delay):
        today = timezone.localdate()
        start = today - timedelta(days=4)
        dates = [start + timedelta(days=i) for i in range(5)]
        # Include Saturday/Sunday only as high-activity days; the profile opts out.
        self._add_days(dates)
        self.user.user_profile.weekend_learning_enabled = False
        self.user.user_profile.save(update_fields=["weekend_learning_enabled"])

        result = detect_user_burnout_risk()

        self.assertEqual(result["flagged"], 0)
        self.assertFalse(BurnoutSignal.objects.filter(user=self.user).exists())
        delay.assert_not_called()

    @patch("apps.burnout_detection.tasks.trigger_intervention.delay")
    def test_weekend_learner_can_trigger_after_five_consecutive_days(self, delay):
        today = timezone.localdate()
        dates = [today - timedelta(days=i) for i in range(4, -1, -1)]
        self._add_days(dates)
        self.user.user_profile.weekend_learning_enabled = True
        self.user.user_profile.save(update_fields=["weekend_learning_enabled"])

        result = detect_user_burnout_risk()

        self.assertEqual(result["flagged"], 1)
        self.assertTrue(
            BurnoutSignal.objects.filter(
                user=self.user, signal_type="irregular_pattern", is_resolved=False
            ).exists()
        )
        delay.assert_called_once_with(self.user.id)

    @patch("apps.burnout_detection.tasks.trigger_intervention.delay")
    def test_fewer_than_five_consecutive_high_days_does_not_trigger(self, delay):
        today = timezone.localdate()
        dates = [today - timedelta(days=i) for i in range(3, -1, -1)]
        self._add_days(dates)
        self.user.user_profile.weekend_learning_enabled = True
        self.user.user_profile.save(update_fields=["weekend_learning_enabled"])

        result = detect_user_burnout_risk()

        self.assertEqual(result["flagged"], 0)
        delay.assert_not_called()
