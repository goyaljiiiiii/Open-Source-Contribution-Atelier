from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.burnout_detection.models import BurnoutActivityDay, BurnoutSignal
from apps.burnout_detection.views import UserWeeklyBurnoutTrendsView

User = get_user_model()


@pytest.fixture
def normal_user(db):
    return User.objects.create_user(
        username="burnout_user_1",
        email="burnout1@example.com",
        password="ValidPassword123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="burnout_user_2",
        email="burnout2@example.com",
        password="ValidPassword123!",
    )


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        username="staff_burnout_admin",
        email="staff_burnout@example.com",
        password="ValidPassword123!",
        is_staff=True,
    )


@pytest.mark.django_db
class TestUserWeeklyBurnoutTrendsAPI:
    def test_unauthenticated_request_returns_401(self):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        request = factory.get("/api/burnout-detection/user-trends/")
        response = view(request)
        assert response.status_code == 401

    def test_authenticated_user_default_8_weeks(self, normal_user):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        request = factory.get("/api/burnout-detection/user-trends/")
        force_authenticate(request, user=normal_user)
        response = view(request)

        assert response.status_code == 200
        data = response.data
        assert data["user_id"] == normal_user.id
        assert data["username"] == normal_user.username
        assert data["weeks_analyzed"] == 8
        assert len(data["weekly_trends"]) == 8

    def test_custom_weeks_clamped(self, normal_user):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        # Query with 4 weeks
        request = factory.get("/api/burnout-detection/user-trends/?weeks=4")
        force_authenticate(request, user=normal_user)
        response = view(request)
        assert response.status_code == 200
        assert response.data["weeks_analyzed"] == 4
        assert len(response.data["weekly_trends"]) == 4

        # Query with invalid negative -> defaults/clamps to 1
        request = factory.get("/api/burnout-detection/user-trends/?weeks=-5")
        force_authenticate(request, user=normal_user)
        response = view(request)
        assert response.status_code == 200
        assert response.data["weeks_analyzed"] == 1

    def test_score_and_metrics_calculation_from_activity_and_signals(self, normal_user):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        today = timezone.now().date()

        # Add heavy daily hours for the past 7 days (e.g. 7h each day)
        for d in range(7):
            BurnoutActivityDay.objects.create(
                user=normal_user,
                date=today - timedelta(days=d),
                active_hours=7.0,
            )

        # Add a burnout signal
        BurnoutSignal.objects.create(
            user=normal_user,
            signal_type="declining_activity",
            severity="moderate",
            description="Activity declined sharply",
        )

        request = factory.get("/api/burnout-detection/user-trends/?weeks=4")
        force_authenticate(request, user=normal_user)
        response = view(request)

        assert response.status_code == 200
        data = response.data
        latest_week = data["weekly_trends"][-1]

        assert latest_week["active_days_count"] == 7
        assert latest_week["total_active_hours"] == 49.0
        assert latest_week["burnout_score"] >= 70.0
        assert latest_week["burnout_risk"] in ("high", "critical")

    def test_staff_can_view_other_user_trends(self, staff_user, normal_user):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        request = factory.get(
            f"/api/burnout-detection/user-trends/?user_id={normal_user.id}"
        )
        force_authenticate(request, user=staff_user)
        response = view(request)

        assert response.status_code == 200
        assert response.data["user_id"] == normal_user.id

    def test_staff_view_nonexistent_user_returns_404(self, staff_user):
        factory = APIRequestFactory()
        view = UserWeeklyBurnoutTrendsView.as_view()

        request = factory.get("/api/burnout-detection/user-trends/?user_id=999999")
        force_authenticate(request, user=staff_user)
        response = view(request)

        assert response.status_code == 404
