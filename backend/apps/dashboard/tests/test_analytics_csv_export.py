import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


@pytest.mark.django_db
class TestAnalyticsCSVExport(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin_csv", email="admin_csv@example.com", password="password"
        )
        self.user = User.objects.create_user(
            username="normal_user", email="normal@example.com", password="password"
        )
        self.export_url = reverse("dashboard:analytics_export_csv")

    def test_unauthenticated_user_cannot_export_csv(self):
        response = self.client.get(self.export_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_stream_csv_export(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.export_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("attachment; filename=", response["Content-Disposition"])

        content = b"".join(response.streaming_content).decode("utf-8")
        self.assertIn("--- REGISTRATIONS ---", content)
        self.assertIn("--- COURSE ENGAGEMENT / PROGRESS STATS ---", content)
        self.assertIn("--- QUIZ ACCURACY STATS ---", content)
        self.assertIn("--- CHALLENGE SUBMISSIONS STATS ---", content)

    def test_dataset_filtering_registrations_only(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.export_url, {"dataset": "registrations", "days": "7"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = b"".join(response.streaming_content).decode("utf-8")
        self.assertIn("--- REGISTRATIONS ---", content)
        self.assertNotIn("--- QUIZ ACCURACY STATS ---", content)
