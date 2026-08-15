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

    def test_export_limit_valid(self):
        UserNote.objects.create(
            user=self.user, lesson=self.lesson, content="Note 1"
        )
        UserNote.objects.create(
            user=self.user, lesson=self.lesson, content="Note 2"
        )

        url = reverse("notes-export")
        response = self.client.get(url, {"format": "json", "limit": "1"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["total_notes"], 1)

    def test_export_limit_invalid_400(self):
        url = reverse("notes-export")
        response = self.client.get(url, {"limit": "0"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.get(url, {"limit": "2000"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.get(url, {"limit": "invalid"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_date_range_cap_400(self):
        url = reverse("notes-export")
        response = self.client.get(
            url, {"start_date": "2024-01-01", "end_date": "2025-01-02"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"], "Date range cannot exceed 1 year (365 days)."
        )

    def test_export_date_range_invalid_400(self):
        url = reverse("notes-export")
        response = self.client.get(
            url, {"start_date": "2025-05-01", "end_date": "2025-04-01"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "start_date cannot be after end_date.")

        response = self.client.get(url, {"start_date": "invalid"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"], "Invalid start_date format. Use YYYY-MM-DD."
        )

