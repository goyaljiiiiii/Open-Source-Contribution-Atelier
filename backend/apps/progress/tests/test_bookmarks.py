from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.content.models import Lesson
from apps.progress.models import LessonBookmark

User = get_user_model()

class LessonBookmarkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            password="password123",
            email="test@example.com"
        )
        self.client.force_authenticate(user=self.user)
        
        self.lesson = Lesson.objects.create(
            title="Intro to Bookmarks",
            slug="intro-bookmarks",
            difficulty="beginner",
            category="general",
            estimated_minutes=15,
            summary="A short summary",
            content="Lesson content"
        )
        
        self.list_url = reverse('lesson-bookmarks-list')
        self.detail_url = reverse('lesson-bookmarks-detail', kwargs={'lesson_slug': self.lesson.slug})

    def test_get_bookmarks_empty(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_add_bookmark(self):
        response = self.client.post(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LessonBookmark.objects.count(), 1)
        self.assertEqual(LessonBookmark.objects.first().lesson, self.lesson)

    def test_add_bookmark_already_exists(self):
        LessonBookmark.objects.create(user=self.user, lesson=self.lesson)
        response = self.client.post(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(LessonBookmark.objects.count(), 1)

    def test_get_bookmarks(self):
        LessonBookmark.objects.create(user=self.user, lesson=self.lesson)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['lesson_slug'], self.lesson.slug)
        self.assertEqual(response.data[0]['lesson_title'], self.lesson.title)

    def test_remove_bookmark(self):
        LessonBookmark.objects.create(user=self.user, lesson=self.lesson)
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(LessonBookmark.objects.count(), 0)

    def test_remove_bookmark_not_found(self):
        response = self.client.delete(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
