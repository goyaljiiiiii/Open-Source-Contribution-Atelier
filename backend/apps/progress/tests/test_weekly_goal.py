import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.progress.models import DailyActivity, LessonProgress, WeeklyGoal, XPEvent

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="goaluser",
        email="goaluser@example.com",
        password="password123",
    )


@pytest.mark.django_db
def test_weekly_goal_unauthenticated(api_client):
    res = api_client.get("/api/progress/weekly-goal/")
    assert res.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


@pytest.mark.django_db
def test_get_weekly_goal_defaults(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.get("/api/progress/weekly-goal/")
    assert res.status_code == status.HTTP_200_OK

    data = res.json()
    assert "week_start_date" in data
    assert "week_end_date" in data
    assert data["target_lessons"] == 5
    assert data["target_xp"] == 500
    assert data["target_minutes"] == 120
    assert data["completed_lessons"] == 0
    assert data["earned_xp"] == 0
    assert len(data["daily_breakdown"]) == 7


@pytest.mark.django_db
def test_update_weekly_goal_targets(api_client, user):
    api_client.force_authenticate(user=user)
    payload = {
        "target_lessons": 10,
        "target_xp": 1000,
        "target_minutes": 300,
    }
    res = api_client.put("/api/progress/weekly-goal/", data=payload, format="json")
    assert res.status_code == status.HTTP_200_OK

    data = res.json()
    assert data["target_lessons"] == 10
    assert data["target_xp"] == 1000
    assert data["target_minutes"] == 300

    goal = WeeklyGoal.get_or_create_current(user)
    assert goal.target_lessons == 10
    assert goal.target_xp == 1000
    assert goal.target_minutes == 300


@pytest.mark.django_db
def test_update_weekly_goal_validation_error(api_client, user):
    api_client.force_authenticate(user=user)
    payload = {"target_lessons": 0}  # Invalid: min 1
    res = api_client.put("/api/progress/weekly-goal/", data=payload, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_weekly_goal_progress_calculation(api_client, user):
    today = timezone.now().date()
    week_start = today - timezone.timedelta(days=today.weekday())

    # Create XP event for this week
    XPEvent.objects.create(
        user=user,
        source_type="lesson",
        base_points=250,
        multiplier=1.0,
        xp_delta=250,
    )

    # Log daily activity
    DailyActivity.log_and_update_streak(user=user, date=today, activity_type="reading")

    api_client.force_authenticate(user=user)
    res = api_client.get("/api/progress/weekly-goal/")
    assert res.status_code == status.HTTP_200_OK

    data = res.json()
    assert data["earned_xp"] == 250
    assert data["xp_progress_pct"] == 50  # 250 / 500 = 50%
    assert data["minutes_spent"] >= 30
    assert any(d["is_today"] and d["is_active"] for d in data["daily_breakdown"])
