from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from apps.dashboard.models import StreakFreeze, Issue
from apps.progress.models import LessonProgress
from apps.content.models import Lesson

class StreakFreezeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.user.date_joined = timezone.now() - timedelta(days=10)
        self.user.save()
        self.client.force_authenticate(user=self.user)
        self.lesson = Lesson.objects.create(slug="test-lesson", title="Test")

    def test_buy_streak_freeze_insufficient_points(self):
        url = reverse("dashboard:buy_streak_freeze")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])

    def test_buy_streak_freeze_success(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lesson, completed=True, score=100)
        
        url = reverse("dashboard:buy_streak_freeze")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(StreakFreeze.objects.count(), 1)
        
    def test_buy_streak_freeze_max_limit(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lesson, completed=True, score=500)
        url = reverse("dashboard:buy_streak_freeze")
        
        for _ in range(3):
            self.client.post(url)
            
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("3 unused", response.data["message"])

    def test_streak_calculation_with_freeze(self):
        lp = LessonProgress.objects.create(user=self.user, lesson=self.lesson, completed=True, score=200)
        LessonProgress.objects.filter(id=lp.id).update(updated_at=timezone.now() - timedelta(days=2))
        
        StreakFreeze.objects.create(user=self.user, cost=100)
        
        url = reverse("dashboard:contributor_stats")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check streak days
        self.assertEqual(response.data["personal_stats"]["streak_days"], 2)
        
        # Freeze should be consumed for yesterday
        self.assertEqual(StreakFreeze.objects.filter(used_on_date__isnull=False).count(), 1)

    def test_missing_two_days_with_one_freeze(self):
        # Activity 3 days ago
        lp = LessonProgress.objects.create(user=self.user, lesson=self.lesson, completed=True, score=200)
        LessonProgress.objects.filter(id=lp.id).update(updated_at=timezone.now() - timedelta(days=3))
        
        # Has only 1 freeze
        StreakFreeze.objects.create(user=self.user, cost=100)
        
        url = reverse("dashboard:contributor_stats")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Missed yesterday and day before yesterday.
        # It consumes the 1 freeze for yesterday, but can't cover the day before yesterday.
        # So streak should just be 1 (for yesterday).
        self.assertEqual(response.data["personal_stats"]["streak_days"], 1)
        self.assertEqual(StreakFreeze.objects.filter(used_on_date__isnull=False).count(), 1)
        
    def test_available_points_calculation(self):
        # Prevent retroactive freeze consumption by setting join date to today
        self.user.date_joined = timezone.now()
        self.user.save()
        
        # Gain 150 points
        LessonProgress.objects.create(user=self.user, lesson=self.lesson, completed=True, score=150)
        
        # Buy freeze (-100 points)
        self.client.post(reverse("dashboard:buy_streak_freeze"))
        
        url = reverse("dashboard:contributor_stats")
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["personal_stats"]["available_points"], 50)
        self.assertEqual(response.data["personal_stats"]["unused_freezes"], 1)
