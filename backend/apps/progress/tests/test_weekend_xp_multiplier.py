import pytest
from datetime import date, datetime
from django.contrib.auth import get_user_model
from apps.progress.streak_engine import StreakEngine
from apps.progress.models import StreakProfile
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
class TestWeekendXpBonusMultiplier:
    def setup_method(self):
        self.user = User.objects.create_user(username="weekend_warrior", password="password")
        self.profile = StreakEngine.get_or_create_profile(self.user)

    def test_is_weekend_event_detection(self):
        # 2026-08-22 is Saturday (weekday=5)
        saturday = date(2026, 8, 22)
        assert StreakEngine.is_weekend_event(saturday) is True

        # 2026-08-23 is Sunday (weekday=6)
        sunday = date(2026, 8, 23)
        assert StreakEngine.is_weekend_event(sunday) is True

        # 2026-08-21 is Friday (weekday=4)
        friday = date(2026, 8, 21)
        assert StreakEngine.is_weekend_event(friday) is False

        # 2026-08-24 is Monday (weekday=0)
        monday = date(2026, 8, 24)
        assert StreakEngine.is_weekend_event(monday) is False

    def test_multiplier_calculation_with_weekend_bonus(self):
        # Baseline: streak 1 day on weekday -> 1.0x
        weekday = date(2026, 8, 19)  # Wednesday
        assert StreakEngine.get_multiplier_for_streak(1, weekday) == 1.0

        # Weekend: streak 1 day on Saturday -> 1.0x * 1.5 = 1.5x
        saturday = date(2026, 8, 22)
        assert StreakEngine.get_multiplier_for_streak(1, saturday) == 1.5

        # 3-day milestone is 1.1x -> on weekend: 1.1 * 1.5 = 1.65x
        assert StreakEngine.get_multiplier_for_streak(3, saturday) == 1.65

        # 7-day milestone is normally 1.25x -> on weekend: 1.25 * 1.5 = 1.88x (rounded to 2 decimal places)
        assert StreakEngine.get_multiplier_for_streak(7, saturday) == 1.88

        # 14-day milestone is 1.5x -> on weekend: 1.5 * 1.5 = 2.25x
        assert StreakEngine.get_multiplier_for_streak(14, saturday) == 2.25

        # 30-day milestone is 2.0x -> on weekend: 2.0 * 1.5 = 3.0x
        assert StreakEngine.get_multiplier_for_streak(30, saturday) == 3.0

    def test_get_multiplier_for_user_on_weekend(self):
        # 7-day streak base multiplier is 1.25x
        self.profile.current_streak = 7
        self.profile.save()

        saturday = date(2026, 8, 22)
        effective = StreakEngine.get_multiplier_for_user(self.user, saturday)
        assert effective == 1.88  # 1.25 * 1.5 = 1.88

        friday = date(2026, 8, 21)
        effective_weekday = StreakEngine.get_multiplier_for_user(self.user, friday)
        assert effective_weekday == 1.25

    def test_get_multiplier_for_nonexistent_profile(self):
        new_user = User.objects.create_user(username="ghost_user", password="password")
        saturday = date(2026, 8, 22)
        effective = StreakEngine.get_multiplier_for_user(new_user, saturday)
        assert effective == 1.5

        monday = date(2026, 8, 24)
        effective_weekday = StreakEngine.get_multiplier_for_user(new_user, monday)
        assert effective_weekday == 1.0

    def test_streak_status_api_endpoint_includes_weekend_fields(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        res = client.get("/api/progress/streak/")
        assert res.status_code == 200
        assert "effective_multiplier" in res.data
        assert "is_weekend_event" in res.data

    def test_record_activity_preserves_streak_and_applies_multipliers(self):
        # Record activity on Saturday
        sat = date(2026, 8, 22)
        res_sat = StreakEngine.record_activity(self.user, sat)
        assert res_sat["current_streak"] == 1
        assert "effective_multiplier" in res_sat

        # Record activity on Sunday
        sun = date(2026, 8, 23)
        res_sun = StreakEngine.record_activity(self.user, sun)
        assert res_sun["current_streak"] == 2
        assert "effective_multiplier" in res_sun
