from unittest.mock import MagicMock, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.ai_tutor.services import AiTutorService
from apps.content.models import Lesson

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_BROKER_URL="memory://")
class AiTutorTests(TestCase):
    def setUp(self):
        self.patcher = patch("apps.core.cache.signals.invalidate_tag_task")
        self.mock_invalidate = self.patcher.start()
        self.addCleanup(self.patcher.stop)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username="tutortestuser",
            email="tutor@test.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.lesson = Lesson.objects.create(
            title="Git Basics",
            slug="git-basics",
            summary="Learn the fundamentals of Git version control.",
            content="Git is a distributed version control system...",
            difficulty="Beginner",
        )

    def test_ask_view_unauthenticated(self):
        self.client.logout()
        response = self.client.post("/api/ai/tutor/ask/", {"question": "What is git?"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ask_view_missing_question(self):
        response = self.client.post("/api/ai/tutor/ask/", {"question": "   "})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_fallback_git_response(self):
        response = self.client.post(
            "/api/ai/tutor/ask/",
            {"question": "How does git work?", "lesson_slug": self.lesson.slug},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("answer", response.data)
        self.assertIn("version control", response.data["answer"].lower())

    def test_fallback_commit_response(self):
        answer = AiTutorService.get_response(question="What is a commit?")
        self.assertIn("snapshot", answer.lower())

    def test_llm_response_mocked(self):
        mock_openai = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = (
            "Git commits track your repository changes over time."
        )
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_openai.chat.completions.create.return_value = mock_response

        with self.settings(OPENAI_API_KEY="sk-fake-key-for-test"):
            with patch.dict("sys.modules", {"openai": mock_openai}):
                answer = AiTutorService.get_response(
                    question="Explain commits",
                    lesson_context="Lesson title: Git Basics",
                    history=[{"question": "Hi", "answer": "Hello!"}],
                )

                self.assertEqual(
                    answer, "Git commits track your repository changes over time."
                )
                mock_openai.chat.completions.create.assert_called_once()

    @override_settings(
        REST_FRAMEWORK={
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "ai_tutor": "2/minute",
            },
        }
    )
    def test_ask_view_is_rate_limited_per_user(self):
        from django.core.cache import cache

        cache.clear()
        with patch.object(AiTutorService, "get_response", return_value="answer"):
            first = self.client.post("/api/ai/tutor/ask/", {"question": "First?"})
            second = self.client.post("/api/ai/tutor/ask/", {"question": "Second?"})
            third = self.client.post("/api/ai/tutor/ask/", {"question": "Third?"})

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(third.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
