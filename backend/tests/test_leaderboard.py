import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.content.models import Lesson
from apps.progress.models import LessonProgress


def make_lesson(slug):
    return Lesson.objects.create(
        title=slug,
        slug=slug,
        difficulty="beginner",
        summary="s",
        content="c",
    )


@pytest.mark.django_db
def test_leaderboard_returns_paginated_results():
    client = APIClient()

    lesson = make_lesson("lesson-lb")
    for i in range(25):
        user = User.objects.create_user(username=f"user{i:02d}", password="pass")
        LessonProgress.objects.create(user=user, lesson=lesson, completed=True, score=i * 10)

    response = client.get("/api/leaderboard/")
    assert response.status_code == 200

    data = response.data
    assert "results" in data
    assert "count" in data
    assert "next" in data

    # First page should have 20 entries (page_size=20)
    assert len(data["results"]) == 20
    assert data["count"] == 25

    # There should be a next page link
    assert data["next"] is not None


@pytest.mark.django_db
def test_leaderboard_second_page():
    client = APIClient()

    lesson = make_lesson("lesson-lb2")
    for i in range(25):
        user = User.objects.create_user(username=f"plb{i:02d}", password="pass")
        LessonProgress.objects.create(user=user, lesson=lesson, completed=True, score=i * 5)

    response = client.get("/api/leaderboard/?page=2")
    assert response.status_code == 200
    data = response.data
    assert len(data["results"]) == 5


@pytest.mark.django_db
def test_leaderboard_ordered_by_score_descending():
    client = APIClient()

    lesson = make_lesson("lesson-lb3")
    scores = [100, 50, 200, 10]
    for idx, score in enumerate(scores):
        user = User.objects.create_user(username=f"scorer{idx}", password="pass")
        LessonProgress.objects.create(user=user, lesson=lesson, completed=True, score=score)

    response = client.get("/api/leaderboard/")
    assert response.status_code == 200
    results = response.data["results"]

    returned_scores = [r["total_score"] for r in results]
    assert returned_scores == sorted(returned_scores, reverse=True)


@pytest.mark.django_db
def test_leaderboard_empty():
    client = APIClient()
    response = client.get("/api/leaderboard/")
    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []
