import json

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.content.models import Lesson
from apps.progress.models import UserNote

User = get_user_model()


class TestExportNotesView(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="password", email="test@example.com"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.lesson = Lesson.objects.create(
            title="Test Lesson",
            slug="test-lesson",
            order=1,
            difficulty="beginner",
            summary="test",
            content="test",
        )

    def test_export_no_notes_404(self):
        url = reverse("notes-export")
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_export_json_success(self):
        UserNote.objects.create(
            user=self.user,
            lesson=self.lesson,
            content="This is a test note",
            tags=["test"],
        )

        url = reverse("notes-export")
        response = self.client.get(url, {"format": "json"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")

        data = response.json()
        self.assertEqual(data["total_notes"], 1)
        self.assertEqual(data["username"], self.user.username)
        self.assertEqual(len(data["notes"]), 1)
        self.assertEqual(data["notes"][0]["content"], "This is a test note")

    def test_export_markdown_success(self):
        UserNote.objects.create(
            user=self.user,
            lesson=self.lesson,
            content="This is a test note",
            tags=["test"],
        )

        url = reverse("notes-export")
        response = self.client.get(url, {"format": "md"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/markdown; charset=utf-8")
        self.assertIn(b"This is a test note", response.content)
