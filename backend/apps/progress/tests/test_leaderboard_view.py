import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.content.models import Lesson
from apps.progress.models import LessonProgress


@pytest.mark.django_db
def test_progress_leaderboard_route_returns_ranked_contributors():
    """The Hall of Fame UI must be able to load its live API route."""
    cache.clear()
    user_model = get_user_model()
    lesson = Lesson.objects.create(
        title="Leaderboard lesson",
        slug="leaderboard-lesson",
        summary="Ranking fixture",
        content="Fixture content",
        order=1,
    )
    alice = user_model.objects.create_user(username="alice", is_staff=False)
    bob = user_model.objects.create_user(username="bob", is_staff=False)
    LessonProgress.objects.create(
        user=alice, lesson=lesson, completed=True, score=100
    )
    LessonProgress.objects.create(user=bob, lesson=lesson, completed=True, score=200)

    response = APIClient().get("/api/progress/leaderboard/?limit=50&page=1")

    assert response.status_code == 200
    assert response.data["total_users"] == 2
    assert [entry["username"] for entry in response.data["leaderboard"]] == [
        "bob",
        "alice",
    ]
