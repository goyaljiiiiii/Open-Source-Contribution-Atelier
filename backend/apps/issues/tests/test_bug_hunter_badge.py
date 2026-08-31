import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.gamification.models import Badge, UserAchievement
from apps.gamification.services import award_badge_service
from apps.issues.models import IssueReport

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        username="bughunteruser", email="bughunter@example.com", password="password123"
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        username="adminuser", email="admin@example.com", password="password123"
    )


@pytest.mark.django_db
class TestBugHunterBadge:
    def test_award_badge_service(self, regular_user):
        badge, _ = Badge.objects.get_or_create(
            name="Bug Hunter",
            defaults={"description": "Awarded for filing 3 verified issue reports."},
        )
        achievement, created = award_badge_service(regular_user, "Bug Hunter")
        assert created is True
        assert achievement.user == regular_user
        assert achievement.badge == badge

        # Idempotent check
        achievement2, created2 = award_badge_service(regular_user, "Bug Hunter")
        assert created2 is False
        assert achievement2 == achievement

    def test_user_cannot_self_verify_issue_report(self, api_client, regular_user):
        api_client.force_authenticate(user=regular_user)

        response = api_client.post(
            "/api/issues/",
            {
                "title": "Malicious Issue",
                "description": "Trying to self-verify",
                "issue_type": "Bug",
                "is_verified": True,
            },
        )
        assert response.status_code == 201
        report = IssueReport.objects.get(id=response.data["id"])
        assert report.is_verified is False
        assert not UserAchievement.objects.filter(
            user=regular_user, badge__name="Bug Hunter"
        ).exists()

    def test_issue_report_under_threshold(self, api_client, regular_user):
        # File 2 verified issue reports directly
        for i in range(2):
            IssueReport.objects.create(
                user=regular_user,
                title=f"Verified Issue {i+1}",
                description=f"Detailed description {i+1}",
                issue_type="Bug",
                is_verified=True,
            )

        assert (
            IssueReport.objects.filter(user=regular_user, is_verified=True).count() == 2
        )
        assert not UserAchievement.objects.filter(
            user=regular_user, badge__name="Bug Hunter"
        ).exists()

    def test_issue_report_threshold_awards_badge(self, regular_user):
        badge, _ = Badge.objects.get_or_create(
            name="Bug Hunter",
            defaults={"description": "Awarded for filing 3 verified issue reports."},
        )

        for i in range(3):
            report = IssueReport.objects.create(
                user=regular_user,
                title=f"Verified Issue {i+1}",
                description=f"Detailed description {i+1}",
                issue_type="Bug",
                is_verified=True,
            )
            if (
                IssueReport.objects.filter(user=regular_user, is_verified=True).count()
                >= 3
            ):
                award_badge_service(regular_user, "Bug Hunter")

        assert (
            IssueReport.objects.filter(user=regular_user, is_verified=True).count() == 3
        )
        assert UserAchievement.objects.filter(
            user=regular_user, badge__name="Bug Hunter"
        ).exists()

    def test_unverified_issue_reports_do_not_award_badge(
        self, api_client, regular_user
    ):
        api_client.force_authenticate(user=regular_user)

        # File 5 unverified issue reports
        for i in range(5):
            response = api_client.post(
                "/api/issues/",
                {
                    "title": f"Unverified Issue {i+1}",
                    "description": f"Detailed description {i+1}",
                    "issue_type": "Bug",
                    "is_verified": False,
                },
            )
            assert response.status_code == 201

        assert (
            IssueReport.objects.filter(user=regular_user, is_verified=False).count()
            == 5
        )
        assert not UserAchievement.objects.filter(
            user=regular_user, badge__name="Bug Hunter"
        ).exists()

    def test_patch_report_to_verified_awards_badge(self, regular_user, admin_user):
        # Create 3 unverified reports as regular user
        reports = []
        for i in range(3):
            reports.append(
                IssueReport.objects.create(
                    user=regular_user,
                    title=f"Draft Issue {i+1}",
                    description=f"Draft description {i+1}",
                    is_verified=False,
                )
            )

        assert not UserAchievement.objects.filter(
            user=regular_user, badge__name="Bug Hunter"
        ).exists()

        # Mark reports verified one by one
        for i, report in enumerate(reports):
            report.is_verified = True
            report.save()

            if (
                IssueReport.objects.filter(user=regular_user, is_verified=True).count()
                >= 3
            ):
                award_badge_service(regular_user, "Bug Hunter")

            if i < 2:
                assert not UserAchievement.objects.filter(
                    user=regular_user, badge__name="Bug Hunter"
                ).exists()
            else:
                assert UserAchievement.objects.filter(
                    user=regular_user, badge__name="Bug Hunter"
                ).exists()
