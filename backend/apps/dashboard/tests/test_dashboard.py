import pytest
from rest_framework.test import APIClient
from apps.progress.models import StreakProfile


@pytest.mark.django_db
def test_contributor_dashboard_personal_stats(user):
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/dashboard/contributor/")

    assert response.status_code == 200

    data = response.json()

    assert "personal_stats" in data


@pytest.mark.django_db
def test_dashboard_personal_stats_uses_streak_profile(user):
    StreakProfile.objects.create(
        user=user,
        current_streak=5,
        longest_streak=11,
    )

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/dashboard/contributor/")

    assert response.status_code == 200

    stats = response.json()["personal_stats"]

    assert stats["streak_days"] == 5
    assert stats["longest_streak"] == 11
