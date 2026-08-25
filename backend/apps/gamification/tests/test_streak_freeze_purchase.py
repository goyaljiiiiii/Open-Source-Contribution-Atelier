import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import status
from rest_framework.test import APIClient

from apps.gamification.models import Purchase, ShopItem
from apps.progress.models import StreakProfile, XPEvent
from apps.progress.streak_engine import StreakEngine
from datetime import date, timedelta

User = get_user_model()


@pytest.mark.django_db
class TestStreakFreezeShieldShopIntegration:
    def setup_method(self):
        self.user = User.objects.create_user(username="shield_buyer", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Award 1000 XP to user
        XPEvent.objects.create(
            user=self.user,
            source_type="bonus",
            source_id=1,
            base_points=1000,
            multiplier=1.0,
            xp_delta=1000,
        )

        self.freeze_item = ShopItem.objects.create(
            name="Streak Freeze Shield",
            description="Protects daily contribution streak from breaking for 1 missed day.",
            item_type="streak_freeze",
            cost=150,
            is_active=True,
            is_limited=False,
        )

    def test_purchase_streak_freeze_increments_profile_inventory(self):
        profile = StreakEngine.get_or_create_profile(self.user)
        assert profile.streak_freezes == 0

        res = self.client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": self.freeze_item.id},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["success"] is True
        assert res.data["remaining_xp"] == 850

        profile.refresh_from_db()
        assert profile.streak_freezes == 1

        # Purchase second freeze
        res2 = self.client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": self.freeze_item.id},
            format="json",
        )
        assert res2.status_code == status.HTTP_200_OK
        profile.refresh_from_db()
        assert profile.streak_freezes == 2

    def test_streak_freeze_preserves_streak_after_missed_day(self):
        # Purchase freeze shield
        self.client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": self.freeze_item.id},
            format="json",
        )
        profile = StreakEngine.get_or_create_profile(self.user)
        assert profile.streak_freezes == 1

        # Start streak on day 1
        day1 = date(2026, 8, 20)
        res1 = StreakEngine.record_activity(self.user, day1)
        assert res1["current_streak"] == 1

        # Extend streak on day 2
        day2 = date(2026, 8, 21)
        res2 = StreakEngine.record_activity(self.user, day2)
        assert res2["current_streak"] == 2

        # Gap day: Missed day 3 (Aug 22), active again on day 4 (Aug 23)
        day4 = date(2026, 8, 23)
        res4 = StreakEngine.record_activity(self.user, day4)
        assert res4["current_streak"] == 3  # Preserved!
        assert res4["streak_freezes"] == 0

        profile.refresh_from_db()
        assert profile.streak_freezes == 0

    def test_multi_day_streak_freeze_shield_preservation(self):
        # Purchase 3 freeze shields
        for _ in range(3):
            self.client.post(
                "/api/gamification/shop/purchase/",
                {"item_id": self.freeze_item.id},
                format="json",
            )
        profile = StreakEngine.get_or_create_profile(self.user)
        assert profile.streak_freezes == 3

        # Start streak on day 1 & 2
        StreakEngine.record_activity(self.user, date(2026, 8, 10))
        StreakEngine.record_activity(self.user, date(2026, 8, 11))

        # Gap of 2 missed days (Aug 12, Aug 13), active on Aug 14
        res = StreakEngine.record_activity(self.user, date(2026, 8, 14))
        assert res["current_streak"] == 3
        assert res["streak_freezes"] == 1  # 2 consumed, 1 left

    def test_streak_resets_if_no_freeze_shield_available(self):
        profile = StreakEngine.get_or_create_profile(self.user)
        assert profile.streak_freezes == 0

        # Day 1 & Day 2
        StreakEngine.record_activity(self.user, date(2026, 8, 20))
        StreakEngine.record_activity(self.user, date(2026, 8, 21))

        # Gap: Missed 2 days, active on Aug 24
        res = StreakEngine.record_activity(self.user, date(2026, 8, 24))
        assert res["current_streak"] == 1  # Reset to 1

    def test_insufficient_xp_rejects_freeze_purchase(self):
        broke_user = User.objects.create_user(username="broke_user", password="password")
        client = APIClient()
        client.force_authenticate(user=broke_user)

        res = client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": self.freeze_item.id},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "Not enough XP" in res.data["error"]

    def test_inactive_shop_item_cannot_be_purchased(self):
        inactive_item = ShopItem.objects.create(
            name="Decommissioned Shield",
            item_type="streak_freeze",
            cost=50,
            is_active=False,
        )
        res = self.client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": inactive_item.id},
            format="json",
        )
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_purchase_history_records_streak_freeze(self):
        self.client.post(
            "/api/gamification/shop/purchase/",
            {"item_id": self.freeze_item.id},
            format="json",
        )
        history_res = self.client.get("/api/gamification/shop/history/")
        assert history_res.status_code == status.HTTP_200_OK
        items = history_res.data
        assert len(items) >= 1
        assert items[0]["item"]["name"] == "Streak Freeze Shield"
