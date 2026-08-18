from datetime import datetime
from datetime import timezone as dt_timezone
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile
from apps.challenges.models import Challenge, ChallengeCompletion, ChallengeOfTheDay

User = get_user_model()


@pytest.mark.django_db
class TestChallengeOfTheDayTimezone:
    def test_cotd_uses_user_local_date(self):
        user = User.objects.create_user(username="tokyo_cotd_user", password="password")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.timezone = "Asia/Tokyo"  # UTC+9
        profile.save()

        c_aug_4 = Challenge.objects.create(title="Aug 4 Challenge", slug="aug-4")
        c_aug_5 = Challenge.objects.create(title="Aug 5 Challenge", slug="aug-5")

        ChallengeOfTheDay.objects.create(
            challenge=c_aug_4, date="2026-08-04", bonus_points=10
        )
        ChallengeOfTheDay.objects.create(
            challenge=c_aug_5, date="2026-08-05", bonus_points=20
        )

        client = APIClient()
        client.force_authenticate(user=user)

        # Mock current time to 2026-08-04 20:00:00 UTC
        # In Asia/Tokyo (UTC+9), this is 2026-08-05 05:00:00 JST (Aug 5th)
        fake_now = datetime(2026, 8, 4, 20, 0, 0, tzinfo=dt_timezone.utc)
        with patch("django.utils.timezone.now", return_value=fake_now):
            response = client.get("/api/challenges/today/")
            assert response.status_code == 200
            # Should fetch Aug 5th challenge for Tokyo user
            assert response.data["title"] == "Aug 5 Challenge"
            assert response.data["bonus_points"] == 20

    def test_complete_cotd_uses_user_local_date(self):
        user = User.objects.create_user(username="tokyo_cotd_completer", password="password")
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.timezone = "Asia/Tokyo"
        profile.save()

        c_aug_5 = Challenge.objects.create(title="Aug 5 Challenge", slug="aug-5-comp")
        ChallengeOfTheDay.objects.create(
            challenge=c_aug_5, date="2026-08-05", bonus_points=50
        )

        client = APIClient()
        client.force_authenticate(user=user)

        fake_now = datetime(2026, 8, 4, 20, 0, 0, tzinfo=dt_timezone.utc)
        with patch("django.utils.timezone.now", return_value=fake_now):
            response = client.post("/api/challenges/today/complete/")
            assert response.status_code == 201
            assert response.data["bonus_earned"] == 50
            assert ChallengeCompletion.objects.filter(user=user, challenge=c_aug_5).exists()
