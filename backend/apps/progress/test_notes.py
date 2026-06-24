from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.content.models import Lesson
from .models import LessonNote

class LessonNoteTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.lesson = Lesson.objects.create(
            title="Test Lesson",
            slug="test-lesson",
            summary="A test lesson",
            content="This is a test lesson",
            difficulty="beginner"
        )
        self.url = reverse("lesson-note", kwargs={"lesson_slug": self.lesson.slug})
        self.client.force_authenticate(user=self.user)

    def test_get_note_empty(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "")
        self.assertEqual(response.data["lesson"], self.lesson.id)
        
        note = LessonNote.objects.get(user=self.user, lesson=self.lesson)
        self.assertEqual(note.content, "")

    def test_post_note_create(self):
        data = {"content": "This is my private note."}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "This is my private note.")
        
        note = LessonNote.objects.get(user=self.user, lesson=self.lesson)
        self.assertEqual(note.content, "This is my private note.")

    def test_post_note_update(self):
        LessonNote.objects.create(user=self.user, lesson=self.lesson, content="Initial content")
        
        data = {"content": "Updated content."}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], "Updated content.")
        
        note = LessonNote.objects.get(user=self.user, lesson=self.lesson)
        self.assertEqual(note.content, "Updated content.")

    def test_invalid_lesson(self):
        invalid_url = reverse("lesson-note", kwargs={"lesson_slug": "invalid-slug"})
        response = self.client.get(invalid_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        response = self.client.post(invalid_url, {"content": "test"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
