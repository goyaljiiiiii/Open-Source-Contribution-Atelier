import pytest
from apps.progress.models import StreakProfile


@pytest.mark.django_db
def test_contributor_dashboard_personal_stats(client, user):
    client.force_login(user)

    response = client.get("/api/dashboard/contributor/")

    assert response.status_code == 200

    data = response.json()

    assert "personal_stats" in data


@pytest.mark.django_db
def test_dashboard_personal_stats_uses_streak_profile(client, user):
    profile = StreakProfile.objects.create(
        user=user,
        current_streak=5,
        longest_streak=11,
    )

    client.force_login(user)

    response = client.get("/api/dashboard/contributor/")

    assert response.status_code == 200

    stats = response.json()["personal_stats"]

    assert stats["streak_days"] == 5
    assert stats["longest_streak"] == 11
