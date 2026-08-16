import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.gamification.models import Badge, UserAchievement

User = get_user_model()


@pytest.mark.django_db
class TestMyAchievementsPagination:
    def test_my_achievements_returns_paginated_envelope(self):
        user = User.objects.create_user(username="ach_user", password="password")
        client = APIClient()
        client.force_authenticate(user=user)

        for i in range(25):
            badge = Badge.objects.create(name=f"Badge {i}", description=f"Desc {i}")
            UserAchievement.objects.create(user=user, badge=badge)

        response = client.get("/api/gamification/my-achievements/")
        assert response.status_code == 200
        assert "count" in response.data
        assert "next" in response.data
        assert "results" in response.data
        assert response.data["count"] == 25
        assert len(response.data["results"]) == 20
