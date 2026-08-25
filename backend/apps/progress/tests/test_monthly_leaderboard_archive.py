from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model

from apps.progress.models import LeaderboardArchive, XPEvent
from apps.progress.services.leaderboard_service import LeaderboardService
from apps.progress.tasks import archive_monthly_leaderboard

User = get_user_model()


@pytest.fixture
def test_users(db):
    user1 = User.objects.create_user(username="alice", email="alice@example.com", password="password123")
    user2 = User.objects.create_user(username="bob", email="bob@example.com", password="password123")
    user3 = User.objects.create_user(username="charlie", email="charlie@example.com", password="password123")
    return [user1, user2, user3]


@pytest.mark.django_db
class TestMonthlyLeaderboardArchive:
    def test_leaderboard_archive_model(self, test_users):
        alice = test_users[0]
        archive = LeaderboardArchive.objects.create(
            user=alice,
            year=2026,
            month=8,
            month_key="2026_08",
            rank=1,
            monthly_xp=500,
        )
        assert archive.user == alice
        assert archive.year == 2026
        assert archive.month == 8
        assert archive.month_key == "2026_08"
        assert archive.rank == 1
        assert archive.monthly_xp == 500
        assert "LeaderboardArchive(user=alice" in str(archive)

    def test_archive_and_reset_monthly_leaderboard_service(self, test_users):
        alice, bob, charlie = test_users

        # Create lifetime XP events for users
        XPEvent.objects.create(user=alice, source_type="lesson", base_points=500, xp_delta=500)
        XPEvent.objects.create(user=bob, source_type="lesson", base_points=300, xp_delta=300)

        target_date = datetime(2026, 8, 31)

        # Mock Redis client
        mock_redis = MagicMock()
        monthly_key = LeaderboardService.get_monthly_key(target_date)
        all_time_key = LeaderboardService.ALL_TIME

        # Simulated monthly scores: Alice=500, Bob=300, Charlie=100
        user_scores = [("alice", 500.0), ("bob", 300.0), ("charlie", 100.0)]
        mock_redis.zrevrange.side_effect = lambda key, start, end, withscores=False: (
            user_scores if key == monthly_key else []
        )

        with patch("apps.progress.services.leaderboard_service.get_redis_client", return_value=mock_redis):
            result = LeaderboardService.archive_and_reset_monthly_leaderboard(target_date=target_date)

        assert result["period"] == "2026_08"
        assert result["archived_count"] == 3

        # Check LeaderboardArchive records created
        alice_archive = LeaderboardArchive.objects.get(user=alice, year=2026, month=8)
        assert alice_archive.rank == 1
        assert alice_archive.monthly_xp == 500

        bob_archive = LeaderboardArchive.objects.get(user=bob, year=2026, month=8)
        assert bob_archive.rank == 2
        assert bob_archive.monthly_xp == 300

        charlie_archive = LeaderboardArchive.objects.get(user=charlie, year=2026, month=8)
        assert charlie_archive.rank == 3
        assert charlie_archive.monthly_xp == 100

        # Verify Redis delete was called ONLY for monthly key, leaving all_time intact
        mock_redis.delete.assert_called_once_with(monthly_key)

        # Verify database XPEvent lifetime total records remain untouched
        assert XPEvent.objects.filter(user=alice).count() == 1
        assert XPEvent.objects.filter(user=bob).count() == 1

    def test_archive_monthly_leaderboard_task(self):
        with patch.object(
            LeaderboardService, "archive_and_reset_monthly_leaderboard"
        ) as mock_archive:
            mock_archive.return_value = {"period": "2026_08", "archived_count": 5}
            res = archive_monthly_leaderboard()
            mock_archive.assert_called_once()
            assert res == {"period": "2026_08", "archived_count": 5}

    def test_celery_beat_schedule_configured(self):
        beat_schedule = getattr(settings, "CELERY_BEAT_SCHEDULE", {})
        assert "archive-monthly-leaderboard" in beat_schedule
        config = beat_schedule["archive-monthly-leaderboard"]
        assert config["task"] == "apps.progress.tasks.archive_monthly_leaderboard"
