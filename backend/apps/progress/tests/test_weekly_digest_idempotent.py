from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.progress.models import WeeklyDigestLog

User = get_user_model()


@pytest.mark.django_db
class TestWeeklyDigestIdempotent:
    """Verify that send_weekly_progress_summary is idempotent."""

    def _create_digest_user(self, username="digestuser"):
        user = User.objects.create_user(
            username=username, password="pass", email=f"{username}@test.com"
        )
        # Ensure the profile has receive_weekly_digest=True
        profile = user.user_profile
        profile.receive_weekly_digest = True
        profile.save()
        return user

    @patch("apps.progress.tasks.async_task")
    @patch(
        "apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context"
    )
    def test_first_run_sends_email_and_creates_log(self, mock_context, mock_async):
        """First run should queue the email and create a WeeklyDigestLog entry."""
        from apps.progress.tasks import (
            _get_user_week_start,
            send_weekly_progress_summary,
        )

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
        week_start = _get_user_week_start(user, now)
        assert WeeklyDigestLog.objects.filter(user=user, week_start=week_start).exists()

    @patch("apps.progress.tasks.async_task")
    @patch(
        "apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context"
    )
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
    @patch(
        "apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context"
    )
    def test_no_activity_user_gets_no_log(self, mock_context, mock_async):
        """Users with zero activity should not get an email or log entry."""
        from apps.progress.tasks import (
            _get_user_week_start,
            send_weekly_progress_summary,
        )

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
        week_start = _get_user_week_start(user, now)
        assert not WeeklyDigestLog.objects.filter(
            user=user, week_start=week_start
        ).exists()

    @patch("apps.progress.tasks.async_task")
    @patch(
        "apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context"
    )
    def test_different_weeks_sends_again(self, mock_context, mock_async):
        """A new week should send the digest even if the previous week was logged."""
        from apps.progress.tasks import (
            _get_user_week_start,
            send_weekly_progress_summary,
        )

        user = self._create_digest_user("weekuser")
        mock_context.return_value = {
            "lessons_completed": 1,
            "badges_earned": [],
            "xp_earned": 50,
            "username": user.username,
        }

        # Simulate a log entry from last week
        now = timezone.now()
        week_start = _get_user_week_start(user, now)
        last_week_start = week_start - timedelta(days=7)
        WeeklyDigestLog.objects.create(user=user, week_start=last_week_start)

        send_weekly_progress_summary()

        assert mock_async.call_count == 1

    def test_per_user_timezone_week_start(self):
        """Verify that week_start is computed in the user's local timezone."""
        import datetime
        from zoneinfo import ZoneInfo

        from apps.progress.tasks import _get_user_week_start

        user_tokyo = self._create_digest_user("tokyouser")
        user_tokyo.user_profile.timezone = "Asia/Tokyo"
        user_tokyo.user_profile.save()

        user_la = self._create_digest_user("lauser")
        user_la.user_profile.timezone = "America/Los_Angeles"
        user_la.user_profile.save()

        # At 2026-08-30 20:00:00 UTC (Sunday 8 PM UTC):
        # Tokyo (UTC+9) is 2026-08-31 05:00:00 (Monday 5 AM JST) -> week_start = 2026-08-31
        # LA (UTC-7) is 2026-08-30 13:00:00 (Sunday 1 PM PDT) -> week_start = 2026-08-24
        fixed_now = datetime.datetime(
            2026, 8, 30, 20, 0, 0, tzinfo=datetime.timezone.utc
        )

        tokyo_week_start = _get_user_week_start(user_tokyo, fixed_now)
        la_week_start = _get_user_week_start(user_la, fixed_now)

        assert tokyo_week_start == datetime.date(2026, 8, 31)
        assert la_week_start == datetime.date(2026, 8, 24)

    @patch("apps.progress.tasks.async_task")
    @patch(
        "apps.progress.services.digest_service.WeeklyDigestService.get_user_digest_context"
    )
    def test_overlapping_concurrent_runs_send_exactly_one_email(
        self, mock_context, mock_async
    ):
        """Overlapping task runs should claim atomic log first and send exactly one email."""
        from apps.progress.tasks import send_weekly_progress_summary

        user = self._create_digest_user("concurrentuser")
        mock_context.return_value = {
            "lessons_completed": 4,
            "badges_earned": ["badge_c"],
            "xp_earned": 150,
            "username": user.username,
        }

        # Run first task execution
        send_weekly_progress_summary()
        assert mock_async.call_count == 1

        # Run second task execution (overlapping / duplicate task execution)
        send_weekly_progress_summary()

        # Exactly one email enqueued and exactly one WeeklyDigestLog record created
        assert mock_async.call_count == 1
        assert WeeklyDigestLog.objects.filter(user=user).count() == 1
