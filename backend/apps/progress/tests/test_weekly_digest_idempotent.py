import pytest
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.progress.models import WeeklyDigestLog

User = get_user_model()


@pytest.mark.django_db
class TestWeeklyDigestIdempotent:
    """Verify that send_weekly_progress_summary is idempotent."""

    def _create_digest_user(self, username="digestuser"):
        user = User.objects.create_user(username=username, password="pass", email=f"{username}@test.com")
        # Ensure the profile has receive_weekly_digest=True
        profile = user.user_profile
        profile.receive_weekly_digest = True
        profile.save()
        return user

    @patch("apps.progress.tasks.async_task")
    @patch("apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context")
    def test_first_run_sends_email_and_creates_log(self, mock_context, mock_async):
        """First run should queue the email and create a WeeklyDigestLog entry."""
        from apps.progress.tasks import send_weekly_progress_summary

        user = self._create_digest_user()
        mock_context.return_value = {
            "lessons_completed": 3,
            "badges_earned": [],
            "xp_earned": 100,
            "username": user.username,
        }

        send_weekly_progress_summary()

        assert mock_async.call_count == 1
        now = timezone.now()
        week_start = (now - timedelta(days=now.weekday())).date()
        assert WeeklyDigestLog.objects.filter(user=user, week_start=week_start).exists()

    @patch("apps.progress.tasks.async_task")
    @patch("apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context")
    def test_second_run_skips_already_sent_user(self, mock_context, mock_async):
        """Re-running the task should not send duplicate emails."""
        from apps.progress.tasks import send_weekly_progress_summary

        user = self._create_digest_user("dupuser")
        mock_context.return_value = {
            "lessons_completed": 5,
            "badges_earned": ["badge1"],
            "xp_earned": 200,
            "username": user.username,
        }

        # First run
        send_weekly_progress_summary()
        assert mock_async.call_count == 1

        # Second run (re-run / retry)
        mock_async.reset_mock()
        send_weekly_progress_summary()
        assert mock_async.call_count == 0, "Second run should not send any emails"

    @patch("apps.progress.tasks.async_task")
    @patch("apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context")
    def test_no_activity_user_gets_no_log(self, mock_context, mock_async):
        """Users with zero activity should not get an email or log entry."""
        from apps.progress.tasks import send_weekly_progress_summary

        user = self._create_digest_user("inactiveuser")
        mock_context.return_value = {
            "lessons_completed": 0,
            "badges_earned": [],
            "xp_earned": 0,
            "username": user.username,
        }

        send_weekly_progress_summary()

        assert mock_async.call_count == 0
        now = timezone.now()
        week_start = (now - timedelta(days=now.weekday())).date()
        assert not WeeklyDigestLog.objects.filter(user=user, week_start=week_start).exists()

    @patch("apps.progress.tasks.async_task")
    @patch("apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context")
    def test_different_weeks_sends_again(self, mock_context, mock_async):
        """A new week should send the digest even if the previous week was logged."""
        from apps.progress.tasks import send_weekly_progress_summary

        user = self._create_digest_user("weekuser")
        mock_context.return_value = {
            "lessons_completed": 1,
            "badges_earned": [],
            "xp_earned": 50,
            "username": user.username,
        }

        # Simulate a log entry from last week
        now = timezone.now()
        last_week_start = (now - timedelta(days=now.weekday() + 7)).date()
        WeeklyDigestLog.objects.create(user=user, week_start=last_week_start)

        send_weekly_progress_summary()

        assert mock_async.call_count == 1
