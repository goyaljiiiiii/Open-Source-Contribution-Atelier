import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.content.models import Lesson, Exercise
from apps.progress.models import HelpRequest, CodeSubmission

User = get_user_model()


@pytest.mark.django_db
class TestCommunityFeedTruncation:
    """Tests for CommunityFeedView description truncation behavior."""

    @pytest.fixture(autouse=True)
    def setup_fixtures(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="feeduser", password="password", is_active=True)
        self.client.force_authenticate(user=self.user)

        self.lesson = Lesson.objects.create(
            title="Lesson 1",
            slug="lesson-1",
            difficulty="beginner",
            summary="Lesson summary",
            content="Lesson content",
        )
        self.exercise = Exercise.objects.create(
            lesson=self.lesson,
            title="Exercise 1",
            prompt="prompt",
            expected_command="git status",
        )

    def test_full_description_returned_by_default(self):
        """Long descriptions (> 200 chars) should not be truncated by default."""
        long_message = "A" * 350
        HelpRequest.objects.create(user=self.user, lesson=self.lesson, message=long_message)

        long_desc = "B" * 400
        CodeSubmission.objects.create(
            user=self.user, exercise=self.exercise, title="My Sub", description=long_desc, code_snippet="print('hello')"
        )

        response = self.client.get("/api/progress/feed/")
        assert response.status_code == status.HTTP_200_OK

        results = response.data["results"]
        hr_entry = next(r for r in results if r["type"] == "help_request")
        cs_entry = next(r for r in results if r["type"] == "code_submission")

        assert hr_entry["description"] == long_message
        assert len(hr_entry["description"]) == 350

        assert cs_entry["description"] == long_desc
        assert len(cs_entry["description"]) == 400

    def test_max_length_param_truncates_and_sets_flag(self):
        """When max_length is provided, descriptions exceeding limit are truncated and is_truncated is True."""
        long_message = "X" * 300
        HelpRequest.objects.create(user=self.user, lesson=self.lesson, message=long_message)

        response = self.client.get("/api/progress/feed/?max_length=50")
        assert response.status_code == status.HTTP_200_OK

        results = response.data["results"]
        hr_entry = next(r for r in results if r["type"] == "help_request")

        assert hr_entry["description"] == "X" * 50
        assert hr_entry["is_truncated"] is True

    def test_max_length_param_short_description_not_truncated(self):
        """When description length is within max_length, is_truncated is False."""
        short_message = "Short help message"
        HelpRequest.objects.create(user=self.user, lesson=self.lesson, message=short_message)

        response = self.client.get("/api/progress/feed/?max_length=100")
        assert response.status_code == status.HTTP_200_OK

        results = response.data["results"]
        hr_entry = next(r for r in results if r["type"] == "help_request")

        assert hr_entry["description"] == short_message
        assert hr_entry["is_truncated"] is False
