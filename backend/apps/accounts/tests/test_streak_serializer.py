import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.serializers import UserListSerializer
from apps.progress.models import StreakProfile

User = get_user_model()


@pytest.mark.django_db
class TestStreakFieldsInUserSerializer:
    def test_streak_fields_default_zero(self):
        user = User.objects.create_user(username="no_streak_user", password="password")
        data = UserListSerializer(user).data
        assert data["streak_days"] == 0
        assert data["longest_streak"] == 0

    def test_streak_fields_reflect_streak_profile(self):
        user = User.objects.create_user(username="streak_user", password="password")
        StreakProfile.objects.create(user=user, current_streak=4, longest_streak=12)
        data = UserListSerializer(user).data
        assert data["streak_days"] == 4
        assert data["longest_streak"] == 12

    def test_bulk_serializer_seeds_streaks(self):
        user1 = User.objects.create_user(username="streak_bulk_1", password="password")
        user2 = User.objects.create_user(username="streak_bulk_2", password="password")
        StreakProfile.objects.create(user=user1, current_streak=2, longest_streak=9)
        data = UserListSerializer([user1, user2], many=True).data
        by_username = {row["username"]: row for row in data}
        assert by_username["streak_bulk_1"]["streak_days"] == 2
        assert by_username["streak_bulk_1"]["longest_streak"] == 9
        assert by_username["streak_bulk_2"]["streak_days"] == 0
        assert by_username["streak_bulk_2"]["longest_streak"] == 0

    def test_public_profile_endpoint_includes_streak_fields(self):
        user = User.objects.create_user(
            username="streak_profile_endpoint", password="password"
        )
        StreakProfile.objects.create(user=user, current_streak=7, longest_streak=7)
        client = APIClient()
        res = client.get(f"/api/auth/profile/{user.username}/")
        assert res.status_code == 200
        assert res.data["streak_days"] == 7
        assert res.data["longest_streak"] == 7
