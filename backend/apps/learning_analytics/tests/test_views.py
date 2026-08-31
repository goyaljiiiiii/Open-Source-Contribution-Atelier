"""
Tests for the Learning Analytics API views.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.learning_analytics.models import (
    DailyLearningMetric,
    LearningGoal,
    LearningInsight,
    LearningSession,
    SkillTag,
    UserSkillProfile,
)


class BaseLearningAnalyticsTest(TestCase):
    """Shared setup for all view tests."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.tag = SkillTag.objects.create(name="JavaScript", slug="javascript")


class LearningSessionListCreateViewTest(BaseLearningAnalyticsTest):
    """Tests for LearningSessionListCreateView."""

    def test_list_sessions_empty(self):
        url = reverse("learning_analytics:session-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_session(self):
        url = reverse("learning_analytics:session-list")
        data = {
            "activity_type": "lesson",
            "xp_earned": 25,
            "score": 85,
            "completed": True,
            "skill_slugs": ["javascript"],
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["activity_type"], "lesson")
        self.assertEqual(response.data["xp_earned"], 25)

    def test_create_session_unauthenticated(self):
        self.client.force_authenticate(user=None)
        url = reverse("learning_analytics:session-list")
        data = {"activity_type": "lesson"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_sessions_with_data(self):
        LearningSession.objects.create(
            user=self.user,
            activity_type="quiz",
            duration_seconds=120,
            xp_earned=30,
        )
        url = reverse("learning_analytics:session-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_invalid_activity_type(self):
        url = reverse("learning_analytics:session-list")
        data = {"activity_type": "invalid_type"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LearningSessionDetailViewTest(BaseLearningAnalyticsTest):
    """Tests for LearningSessionDetailView."""

    def test_retrieve_own_session(self):
        session = LearningSession.objects.create(
            user=self.user,
            activity_type="exercise",
            duration_seconds=60,
        )
        url = reverse("learning_analytics:session-detail", args=[session.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cannot_retrieve_other_users_session(self):
        session = LearningSession.objects.create(
            user=self.other_user,
            activity_type="lesson",
        )
        url = reverse("learning_analytics:session-detail", args=[session.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_session(self):
        session = LearningSession.objects.create(
            user=self.user,
            activity_type="lesson",
        )
        url = reverse("learning_analytics:session-detail", args=[session.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LearningSession.objects.filter(id=session.id).exists())


class SkillTagListViewTest(BaseLearningAnalyticsTest):
    """Tests for SkillTagListView."""

    def test_list_skill_tags(self):
        url = reverse("learning_analytics:skill-tag-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        url = reverse("learning_analytics:skill-tag-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class UserSkillProfileListViewTest(BaseLearningAnalyticsTest):
    """Tests for UserSkillProfileListView."""

    def test_list_profiles_empty(self):
        url = reverse("learning_analytics:skill-profile-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_list_profiles_with_data(self):
        UserSkillProfile.objects.create(
            user=self.user,
            skill_tag=self.tag,
            level=50,
        )
        url = reverse("learning_analytics:skill-profile-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_does_not_show_other_users(self):
        UserSkillProfile.objects.create(
            user=self.other_user,
            skill_tag=self.tag,
            level=80,
        )
        url = reverse("learning_analytics:skill-profile-list")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 0)


class SkillLevelRefreshViewTest(BaseLearningAnalyticsTest):
    """Tests for SkillLevelRefreshView."""

    def test_refresh_no_sessions(self):
        url = reverse("learning_analytics:skill-level-refresh")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["refreshed"], 0)

    def test_refresh_with_sessions(self):
        now = __import__("django.utils", fromlist=["timezone"]).timezone.now()
        session = LearningSession.objects.create(
            user=self.user,
            activity_type="lesson",
            started_at=now,
            duration_seconds=300,
            xp_earned=50,
            score=90,
            completed=True,
        )
        session.skill_tags.create(skill_tag=self.tag)

        url = reverse("learning_analytics:skill-level-refresh")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["refreshed"], 1)
        self.assertTrue(
            UserSkillProfile.objects.filter(user=self.user, skill_tag=self.tag).exists()
        )


class LearningInsightListViewTest(BaseLearningAnalyticsTest):
    """Tests for LearningInsightListView."""

    def test_list_empty(self):
        url = reverse("learning_analytics:insight-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_with_insights(self):
        LearningInsight.objects.create(
            user=self.user,
            insight_type="tip",
            title="Test Tip",
            body="Test body",
        )
        url = reverse("learning_analytics:insight-list")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 1)

    def test_excludes_dismissed(self):
        LearningInsight.objects.create(
            user=self.user,
            insight_type="tip",
            title="Dismissed",
            body="Body",
            is_dismissed=True,
        )
        url = reverse("learning_analytics:insight-list")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 0)


class InsightDismissViewTest(BaseLearningAnalyticsTest):
    """Tests for InsightDismissView."""

    def test_dismiss_insight(self):
        insight = LearningInsight.objects.create(
            user=self.user,
            insight_type="warning",
            title="Warning",
            body="Something",
        )
        url = reverse("learning_analytics:insight-dismiss")
        response = self.client.post(url, {"insight_id": insight.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        insight.refresh_from_db()
        self.assertTrue(insight.is_dismissed)

    def test_dismiss_nonexistent(self):
        url = reverse("learning_analytics:insight-dismiss")
        response = self.client.post(url, {"insight_id": 9999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class InsightBulkReadViewTest(BaseLearningAnalyticsTest):
    """Tests for InsightBulkReadView."""

    def test_bulk_read(self):
        i1 = LearningInsight.objects.create(
            user=self.user,
            insight_type="tip",
            title="Tip 1",
            body="Body 1",
        )
        i2 = LearningInsight.objects.create(
            user=self.user,
            insight_type="tip",
            title="Tip 2",
            body="Body 2",
        )
        url = reverse("learning_analytics:insight-bulk-read")
        response = self.client.post(
            url,
            {"insight_ids": [i1.id, i2.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_read"], 2)


class AnalyticsDashboardViewTest(BaseLearningAnalyticsTest):
    """Tests for AnalyticsDashboardView."""

    def test_empty_dashboard(self):
        url = reverse("learning_analytics:analytics-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
        self.assertIn("charts", response.data)

    def test_dashboard_with_custom_days(self):
        url = reverse("learning_analytics:analytics-dashboard")
        response = self.client.get(url, {"days": 7})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_days"], 7)

    def test_dashboard_clamps_days(self):
        url = reverse("learning_analytics:analytics-dashboard")
        response = self.client.get(url, {"days": 1})
        self.assertEqual(response.data["period_days"], 7)

    def test_unauthenticated(self):
        self.client.force_authenticate(user=None)
        url = reverse("learning_analytics:analytics-dashboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DailyMetricsListViewTest(BaseLearningAnalyticsTest):
    """Tests for DailyMetricsListView."""

    def test_list_empty(self):
        url = reverse("learning_analytics:daily-metrics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_list_with_data(self):
        DailyLearningMetric.objects.create(
            user=self.user,
            date=timezone.now().date(),
            total_minutes=45,
        )
        url = reverse("learning_analytics:daily-metrics")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 1)


class VelocityViewTest(BaseLearningAnalyticsTest):
    """Tests for VelocityView."""

    def test_velocity_empty(self):
        url = reverse("learning_analytics:velocity")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("minutes_per_day", response.data)

    def test_velocity_with_data(self):
        today = timezone.now().date()
        for i in range(7):
            DailyLearningMetric.objects.create(
                user=self.user,
                date=today - timedelta(days=i),
                total_minutes=30,
                xp_earned=50,
            )
        url = reverse("learning_analytics:velocity")
        response = self.client.get(url)
        self.assertGreater(response.data["minutes_per_day"], 0)


class WeeklySummaryViewTest(BaseLearningAnalyticsTest):
    """Tests for WeeklySummaryView."""

    def test_empty_summary(self):
        url = reverse("learning_analytics:weekly-summary")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("period", response.data)
        self.assertIn("recommendations", response.data)


class MonthlyRecapViewTest(BaseLearningAnalyticsTest):
    """Tests for MonthlyRecapView."""

    def test_empty_recap(self):
        url = reverse("learning_analytics:monthly-recap")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("this_month", response.data)


class LearningGoalListCreateViewTest(BaseLearningAnalyticsTest):
    """Tests for LearningGoalListCreateView."""

    def test_list_goals_empty(self):
        url = reverse("learning_analytics:goal-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_goal(self):
        url = reverse("learning_analytics:goal-list")
        data = {
            "goal_type": "xp_target",
            "title": "Reach 500 XP",
            "target_value": 500,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Reach 500 XP")

    def test_create_skill_level_goal_without_slug(self):
        url = reverse("learning_analytics:goal-list")
        data = {
            "goal_type": "skill_level",
            "title": "Level up",
            "target_value": 50,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_skill_level_goal_with_slug(self):
        url = reverse("learning_analytics:goal-list")
        data = {
            "goal_type": "skill_level",
            "title": "Level up",
            "target_value": 50,
            "skill_slug": "javascript",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_excludes_archived(self):
        LearningGoal.objects.create(
            user=self.user,
            goal_type="xp_target",
            title="Archived Goal",
            target_value=100,
            is_archived=True,
        )
        url = reverse("learning_analytics:goal-list")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 0)


class LearningGoalDetailViewTest(BaseLearningAnalyticsTest):
    """Tests for LearningGoalDetailView."""

    def setUp(self):
        super().setUp()
        self.goal = LearningGoal.objects.create(
            user=self.user,
            goal_type="xp_target",
            title="My Goal",
            target_value=100,
        )

    def test_retrieve_goal(self):
        url = reverse("learning_analytics:goal-detail", args=[self.goal.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "My Goal")

    def test_update_goal(self):
        url = reverse("learning_analytics:goal-detail", args=[self.goal.id])
        response = self.client.patch(url, {"current_value": 50}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_value"], 50)

    def test_complete_goal(self):
        url = reverse("learning_analytics:goal-detail", args=[self.goal.id])
        response = self.client.patch(url, {"action": "complete"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_completed"])

    def test_archive_goal(self):
        url = reverse("learning_analytics:goal-detail", args=[self.goal.id])
        response = self.client.patch(url, {"action": "archive"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_goal(self):
        url = reverse("learning_analytics:goal-detail", args=[self.goal.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class GoalPredictionViewTest(BaseLearningAnalyticsTest):
    """Tests for GoalPredictionView."""

    def test_prediction(self):
        goal = LearningGoal.objects.create(
            user=self.user,
            goal_type="xp_target",
            title="1000 XP",
            target_value=1000,
            current_value=200,
        )
        url = reverse("learning_analytics:goal-prediction", args=[goal.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("confidence", response.data)

    def test_prediction_nonexistent(self):
        url = reverse("learning_analytics:goal-prediction", args=[9999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_prediction_completed_goal(self):
        goal = LearningGoal.objects.create(
            user=self.user,
            goal_type="xp_target",
            title="Done",
            target_value=100,
            is_completed=True,
        )
        url = reverse("learning_analytics:goal-prediction", args=[goal.id])
        response = self.client.get(url)
        self.assertEqual(response.data["confidence"], "completed")


# Import timezone at module level for DailyMetricsListViewTest
from django.utils import timezone
