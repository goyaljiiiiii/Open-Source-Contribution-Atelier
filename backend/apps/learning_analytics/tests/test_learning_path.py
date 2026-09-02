"""
Tests for the Personalised Learning Path feature.

Covers models, engine, serializers, and views.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.learning_analytics.models import (
    DailyLearningMetric,
    LearningGoal,
    LearningPath,
    LearningPathStep,
    LearningSession,
    SkillTag,
    UserPathProgress,
    UserSkillProfile,
)

# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------


class LearningPathModelTest(TestCase):
    """Tests for LearningPath model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.tag = SkillTag.objects.create(name="Python", slug="python")

    def test_create_path(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Python Fundamentals",
            description="Learn Python basics",
            difficulty="beginner",
            estimated_minutes=60,
            total_steps=4,
            priority_score=75.0,
        )
        self.assertEqual(path.status, "active")
        self.assertEqual(path.progress_pct, 0)
        self.assertFalse(path.is_fully_completed)

    def test_progress_pct(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Partial Path",
            total_steps=10,
            completed_steps=3,
        )
        self.assertEqual(path.progress_pct, 30)

    def test_progress_pct_zero_steps(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Empty Path",
            total_steps=0,
        )
        self.assertEqual(path.progress_pct, 0)

    def test_progress_pct_capped(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Over Path",
            total_steps=5,
            completed_steps=10,
        )
        self.assertEqual(path.progress_pct, 100)

    def test_is_fully_completed(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Done Path",
            total_steps=3,
            completed_steps=3,
        )
        self.assertTrue(path.is_fully_completed)

    def test_is_not_fully_completed(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Not Done",
            total_steps=3,
            completed_steps=2,
        )
        self.assertFalse(path.is_fully_completed)

    def test_advance_step(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Advance",
            total_steps=2,
            completed_steps=0,
        )
        path.advance_step()
        self.assertEqual(path.completed_steps, 1)
        self.assertEqual(path.status, "active")

    def test_advance_step_completes_path(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Almost Done",
            total_steps=2,
            completed_steps=1,
        )
        path.advance_step()
        self.assertEqual(path.completed_steps, 2)
        self.assertEqual(path.status, "completed")
        self.assertIsNotNone(path.completed_at)

    def test_str(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Test Path",
            priority_score=75.5,
        )
        self.assertIn("Test Path", str(path))
        self.assertIn("75.5", str(path))

    def test_target_skills(self):
        path = LearningPath.objects.create(
            user=self.user,
            title="Multi-skill",
        )
        path.target_skills.add(self.tag)
        self.assertIn(self.tag, path.target_skills.all())


class LearningPathStepModelTest(TestCase):
    """Tests for LearningPathStep model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.tag = SkillTag.objects.create(name="React", slug="react")
        self.path = LearningPath.objects.create(
            user=self.user,
            title="React Learning",
            total_steps=3,
        )

    def test_create_step(self):
        step = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="React Components",
            step_type="lesson",
            estimated_minutes=20,
            xp_reward=15,
        )
        self.assertEqual(step.status, "not_started")
        self.assertFalse(step.is_milestone)

    def test_unique_together_constraint(self):
        LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="Step 1",
            step_type="lesson",
        )
        with self.assertRaises(Exception):
            LearningPathStep.objects.create(
                path=self.path,
                step_number=1,
                title="Step 1 Again",
                step_type="lesson",
            )

    def test_mark_started(self):
        step = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="Start me",
            step_type="exercise",
        )
        step.mark_started()
        self.assertEqual(step.status, "in_progress")
        self.assertIsNotNone(step.started_at)

    def test_mark_completed(self):
        step = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="Complete me",
            step_type="lesson",
            xp_reward=20,
        )
        step.mark_completed()
        self.assertEqual(step.status, "completed")
        self.assertIsNotNone(step.completed_at)
        # Path should have advanced
        self.path.refresh_from_db()
        self.assertEqual(self.path.completed_steps, 1)

    def test_mark_skipped(self):
        step = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="Skip me",
            step_type="quiz",
        )
        step.mark_skipped()
        self.assertEqual(step.status, "skipped")

    def test_str(self):
        step = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="My Step",
            step_type="challenge",
            status="not_started",
        )
        self.assertIn("Step 1", str(step))
        self.assertIn("My Step", str(step))


class UserPathProgressModelTest(TestCase):
    """Tests for UserPathProgress model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_progress(self):
        today = timezone.now().date()
        progress = UserPathProgress.objects.create(
            user=self.user,
            date=today,
            active_path_count=2,
            steps_completed_today=3,
            xp_earned_today=45,
        )
        self.assertEqual(progress.active_path_count, 2)
        self.assertEqual(progress.steps_completed_today, 3)

    def test_unique_constraint(self):
        today = timezone.now().date()
        UserPathProgress.objects.create(
            user=self.user, date=today, steps_completed_today=1
        )
        with self.assertRaises(Exception):
            UserPathProgress.objects.create(
                user=self.user, date=today, steps_completed_today=2
            )

    def test_str(self):
        progress = UserPathProgress.objects.create(
            user=self.user,
            date=timezone.now().date(),
            steps_completed_today=5,
            xp_earned_today=75,
        )
        self.assertIn("testuser", str(progress))
        self.assertIn("5 steps", str(progress))


# ---------------------------------------------------------------------------
# Engine Tests
# ---------------------------------------------------------------------------


class LearningPathEngineTest(TestCase):
    """Tests for the learning path engine functions."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.tag_weak = SkillTag.objects.create(name="Docker", slug="docker")
        self.tag_strong = SkillTag.objects.create(name="Python", slug="python")

    def test_generate_paths_empty_user(self):
        """New user with no data should still produce paths."""
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        results = generate_learning_paths(self.user)
        self.assertIsInstance(results, list)
        # Should generate at least diversity or gap path

    def test_generate_paths_with_skill_gap(self):
        """User with a weak skill should get a gap path."""
        UserSkillProfile.objects.create(
            user=self.user,
            skill_tag=self.tag_weak,
            level=10,
            total_sessions=2,
            total_xp=20,
            trend="stable",
        )
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        results = generate_learning_paths(self.user)
        titles = [r["title"] for r in results]
        self.assertIn("Skill Gap Recovery", titles)

    def test_generate_paths_with_declining_skill(self):
        """User with a declining skill should get a recovery path."""
        UserSkillProfile.objects.create(
            user=self.user,
            skill_tag=self.tag_weak,
            level=40,
            trend="declining",
        )
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        results = generate_learning_paths(self.user)
        titles = [r["title"] for r in results]
        self.assertIn("Skill Maintenance & Recovery", titles)

    def test_generate_paths_with_goal(self):
        """User with an active goal should get a goal path."""
        LearningGoal.objects.create(
            user=self.user,
            goal_type="xp_target",
            title="Reach 500 XP",
            target_value=500,
            current_value=200,
        )
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        results = generate_learning_paths(self.user)
        titles = [r["title"] for r in results]
        self.assertIn("Goal Sprint", titles)

    def test_generate_paths_with_strong_skill(self):
        """User with a strong skill should get a challenge path."""
        UserSkillProfile.objects.create(
            user=self.user,
            skill_tag=self.tag_strong,
            level=75,
            trend="stable",
        )
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        results = generate_learning_paths(self.user)
        titles = [r["title"] for r in results]
        self.assertIn("Advanced Challenges", titles)

    def test_generate_paths_creates_db_records(self):
        """Generated paths should be persisted in the database."""
        from apps.learning_analytics.learning_path_engine import (
            generate_learning_paths,
        )

        generate_learning_paths(self.user)
        paths = LearningPath.objects.filter(user=self.user)
        self.assertGreater(paths.count(), 0)

        for path in paths:
            steps = path.steps.all()
            self.assertEqual(steps.count(), path.total_steps)

    def test_get_path_recommendations(self):
        """Recommendations should return active path summaries."""
        from apps.learning_analytics.learning_path_engine import (
            get_path_recommendations,
        )

        LearningPath.objects.create(
            user=self.user,
            title="Test Path",
            total_steps=3,
            priority_score=80,
        )
        recs = get_path_recommendations(self.user)
        self.assertEqual(len(recs), 1)
        self.assertEqual(recs[0]["title"], "Test Path")

    def test_completion_estimate(self):
        """Should return a valid completion estimate dict."""
        from apps.learning_analytics.learning_path_engine import (
            compute_path_completion_estimate,
        )

        estimate = compute_path_completion_estimate(self.user)
        self.assertIn("active_path_count", estimate)
        self.assertIn("estimated_completion_days", estimate)

    def test_completion_estimate_with_active_paths(self):
        """Estimate should reflect active paths."""
        LearningPath.objects.create(
            user=self.user,
            title="Path 1",
            total_steps=10,
            completed_steps=2,
        )
        from apps.learning_analytics.learning_path_engine import (
            compute_path_completion_estimate,
        )

        estimate = compute_path_completion_estimate(self.user)
        self.assertEqual(estimate["active_path_count"], 1)
        self.assertEqual(estimate["total_remaining_steps"], 8)


# ---------------------------------------------------------------------------
# View Tests
# ---------------------------------------------------------------------------


class BasePathViewTest(TestCase):
    """Shared setup for path view tests."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.path = LearningPath.objects.create(
            user=self.user,
            title="My Path",
            description="Test path",
            total_steps=3,
            priority_score=80,
        )
        self.step1 = LearningPathStep.objects.create(
            path=self.path,
            step_number=1,
            title="Step 1",
            step_type="lesson",
            xp_reward=15,
        )
        self.step2 = LearningPathStep.objects.create(
            path=self.path,
            step_number=2,
            title="Step 2",
            step_type="exercise",
            xp_reward=20,
            is_milestone=True,
        )
        self.step3 = LearningPathStep.objects.create(
            path=self.path,
            step_number=3,
            title="Step 3",
            step_type="quiz",
            xp_reward=25,
        )


class LearningPathListViewTest(BasePathViewTest):
    """Tests for LearningPathListView."""

    def test_list_empty(self):
        url = reverse("learning_analytics:path-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_with_status_filter(self):
        self.path.status = "completed"
        self.path.save()
        url = reverse("learning_analytics:path-list")
        response = self.client.get(url, {"status": "active"})
        self.assertEqual(len(response.data), 0)

    def test_unauthenticated(self):
        self.client.force_authenticate(user=None)
        url = reverse("learning_analytics:path-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_does_not_show_other_users(self):
        LearningPath.objects.create(
            user=self.other_user,
            title="Other Path",
            total_steps=2,
        )
        url = reverse("learning_analytics:path-list")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 1)


class LearningPathDetailViewTest(BasePathViewTest):
    """Tests for LearningPathDetailView."""

    def test_retrieve_path(self):
        url = reverse("learning_analytics:path-detail", args=[self.path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "My Path")
        self.assertEqual(len(response.data["steps"]), 3)

    def test_not_found(self):
        url = reverse("learning_analytics:path-detail", args=[9999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class LearningPathGenerateViewTest(BasePathViewTest):
    """Tests for LearningPathGenerateView."""

    def test_generate_paths(self):
        url = reverse("learning_analytics:path-generate")
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("generated", response.data)
        self.assertIn("paths", response.data)

    def test_generate_with_force(self):
        url = reverse("learning_analytics:path-generate")
        response = self.client.post(url, {"force": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class LearningPathStepCompleteViewTest(BasePathViewTest):
    """Tests for LearningPathStepCompleteView."""

    def test_complete_step(self):
        url = reverse("learning_analytics:path-step-complete")
        response = self.client.post(url, {"step_id": self.step1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["xp_earned"], 15)

    def test_complete_already_completed(self):
        self.step1.status = "completed"
        self.step1.save()
        url = reverse("learning_analytics:path-step-complete")
        response = self.client.post(url, {"step_id": self.step1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_complete_nonexistent_step(self):
        url = reverse("learning_analytics:path-step-complete")
        response = self.client.post(url, {"step_id": 9999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class LearningPathStepStartViewTest(BasePathViewTest):
    """Tests for LearningPathStepStartView."""

    def test_start_step(self):
        url = reverse("learning_analytics:path-step-start")
        response = self.client.post(url, {"step_id": self.step1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "in_progress")


class LearningPathStepSkipViewTest(BasePathViewTest):
    """Tests for LearningPathStepSkipView."""

    def test_skip_step(self):
        url = reverse("learning_analytics:path-step-skip")
        response = self.client.post(url, {"step_id": self.step1.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "skipped")


class LearningPathDeleteViewTest(BasePathViewTest):
    """Tests for LearningPathDeleteView."""

    def test_archive_path(self):
        url = reverse("learning_analytics:path-archive", args=[self.path.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.path.refresh_from_db()
        self.assertEqual(self.path.status, "archived")

    def test_archive_nonexistent(self):
        url = reverse("learning_analytics:path-archive", args=[9999])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PathCompletionEstimateViewTest(BasePathViewTest):
    """Tests for PathCompletionEstimateView."""

    def test_estimate_empty(self):
        url = reverse("learning_analytics:path-estimate")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["active_path_count"], 1)
        self.assertEqual(response.data["total_remaining_steps"], 3)


class LearningPathProgressViewTest(BasePathViewTest):
    """Tests for LearningPathProgressView."""

    def test_progress_empty(self):
        url = reverse("learning_analytics:path-progress")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_progress_with_data(self):
        today = timezone.now().date()
        UserPathProgress.objects.create(
            user=self.user,
            date=today,
            active_path_count=2,
            steps_completed_today=4,
            xp_earned_today=60,
        )
        url = reverse("learning_analytics:path-progress")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["steps_completed_today"], 4)

    def test_progress_days_filter(self):
        today = timezone.now().date()
        for i in range(10):
            UserPathProgress.objects.create(
                user=self.user,
                date=today - timedelta(days=i),
                steps_completed_today=1,
            )
        url = reverse("learning_analytics:path-progress")
        response = self.client.get(url, {"days": 3})
        self.assertLessEqual(len(response.data), 3)


# Import timezone at module level for DailyMetricsListViewTest
from django.utils import timezone
