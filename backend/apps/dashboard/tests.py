from datetime import timedelta

from django.contrib.auth import get_user_model

User = get_user_model()
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase


class LeaderboardTests(APITestCase):
    def setUp(self):
        # Create users
        for i in range(25):
            User.objects.create_user(username=f"user{i}", password="password")

    def test_cursor_pagination(self):
        url = reverse("leaderboard")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # CursorPagination returns 'next' as a cursor link, not page=2
        self.assertIn("cursor=", response.data["next"])
        self.assertNotIn("page=", response.data["next"])

        # Total results shouldn't be counted in cursor pagination usually, but let's check size
        self.assertEqual(len(response.data["results"]), 20)

        # Fetch next page
        next_url = response.data["next"]
        next_response = self.client.get(next_url)
        self.assertEqual(next_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(next_response.data["results"]), 5)

    def test_cursor_invalid_format(self):
        # DRF CursorPagination returns 404 for invalid cursors
        url = (
            reverse("leaderboard") + "?cursor=invalid_base64_string_that_makes_no_sense"
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cursor_identical_xp(self):
        # Test stable ordering when many users have the exact same XP
        url = reverse("leaderboard")
        response = self.client.get(url)

        # All 25 users have 0 XP right now
        results = response.data["results"]

        # Verify they are ordered predictably (by username or id as defined in ordering)
        # ordering is ("-xp", "username", "id")
        # Since xp is 0 for all, it should be alphabetical by username
        usernames = [r["username"] for r in results]

        # However, user0, user1, user10, user11... will be the alphabetical order
        sorted_usernames = sorted(usernames)
        self.assertEqual(usernames, sorted_usernames)


class IssueModelTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")

    def test_issue_total_points(self):
        from apps.dashboard.models import Issue

        issue = Issue.objects.create(
            title="Test", assigned_to=self.user, points=50, bonus_points=15
        )
        self.assertEqual(issue.total_points, 65)

    def test_issue_no_bonus_points(self):
        from apps.dashboard.models import Issue

        issue = Issue.objects.create(title="Test", assigned_to=self.user, points=50)
        self.assertEqual(issue.total_points, 50)


class ContinueLearningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="learner", password="password")
        from apps.content.models import Lesson
        from apps.progress.models import LessonProgress

        self.lesson1 = Lesson.objects.create(
            title="Lesson 1", slug="lesson-1", summary="Summary 1", difficulty="beginner"
        )
        self.lesson2 = Lesson.objects.create(
            title="Lesson 2", slug="lesson-2", summary="Summary 2", difficulty="beginner"
        )
        self.lesson3 = Lesson.objects.create(
            title="Lesson 3", slug="lesson-3", summary="Summary 3", difficulty="intermediate"
        )
        self.lesson4 = Lesson.objects.create(
            title="Lesson 4", slug="lesson-4", summary="Summary 4", difficulty="advanced"
        )

        # Create progress items
        self.lp1 = LessonProgress.objects.create(
            user=self.user, lesson=self.lesson1, completed=False, score=40
        )
        self.lp2 = LessonProgress.objects.create(
            user=self.user, lesson=self.lesson2, completed=False, score=70
        )
        self.lp3 = LessonProgress.objects.create(
            user=self.user, lesson=self.lesson3, completed=False, score=10
        )
        self.lp4 = LessonProgress.objects.create(
            user=self.user, lesson=self.lesson4, completed=True, score=100
        )

    def test_continue_learning_returns_max_3_incomplete_lessons(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("dashboard:contributor_stats")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("continue_learning", response.data)
        continue_learning = response.data["continue_learning"]

        self.assertEqual(len(continue_learning), 3)
        slugs = [item["lesson_slug"] for item in continue_learning]
        self.assertNotIn("lesson-4", slugs)  # Completed lesson excluded

    def test_continue_learning_empty_when_no_incomplete(self):
        user2 = User.objects.create_user(username="finished_user", password="password")
        self.client.force_authenticate(user=user2)
        url = reverse("dashboard:contributor_stats")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["continue_learning"], [])

