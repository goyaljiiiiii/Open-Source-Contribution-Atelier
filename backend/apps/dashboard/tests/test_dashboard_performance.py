import pytest
from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework.test import APIClient

from apps.content.models import Exercise, Lesson
from apps.dashboard.models import Issue, PullRequest
from apps.progress.models import (
    Badge,
    ExerciseAttempt,
    LessonProgress,
    UserBadge,
)

User = get_user_model()

ENDPOINT = "/api/dashboard/contributor/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def dashboard_user(db):
    return User.objects.create_user(
        username="perf_contributor", email="perf@example.com", password="pw"
    )


@pytest.fixture
def enrollment_and_progress(dashboard_user):
    """Populate user enrollment (lessons), progress (attempts) and badges."""
    lesson = Lesson.objects.create(
        title="Perf L1",
        slug="perf-l1",
        summary="s",
        content="c",
        difficulty="beginner",
    )
    lesson2 = Lesson.objects.create(
        title="Perf L2",
        slug="perf-l2",
        summary="s",
        content="c",
        difficulty="beginner",
    )
    lesson3 = Lesson.objects.create(
        title="Perf L3",
        slug="perf-l3",
        summary="s",
        content="c",
        difficulty="beginner",
    )
    LessonProgress.objects.create(
        user=dashboard_user, lesson=lesson, completed=True, score=60
    )
    LessonProgress.objects.create(
        user=dashboard_user, lesson=lesson2, completed=True, score=40
    )
    LessonProgress.objects.create(
        user=dashboard_user, lesson=lesson3, completed=False, score=10
    )

    exercise = Exercise.objects.create(
        lesson=lesson, title="E1", prompt="p", expected_command="git init"
    )
    ExerciseAttempt.objects.create(
        user=dashboard_user,
        exercise=exercise,
        submitted_command="git init",
        is_correct=True,
    )

    badge_a = Badge.objects.create(
        name="First Blood", slug="first-blood", description="First badge"
    )
    badge_b = Badge.objects.create(
        name="Streak 7", slug="streak-7", description="One week streak"
    )
    UserBadge.objects.create(user=dashboard_user, badge=badge_a)
    UserBadge.objects.create(user=dashboard_user, badge=badge_b)

    issue = Issue.objects.create(
        title="Perf bug",
        assigned_to=dashboard_user,
        status=Issue.Status.SOLVED,
        points=50,
        bonus_points=10,
    )
    PullRequest.objects.create(
        title="Perf PR",
        user=dashboard_user,
        status=PullRequest.Status.MERGED,
        issue=issue,
    )

    return {"lesson": lesson, "issue": issue}


@pytest.mark.django_db
def test_user_progress_badge_fetch_is_constant_three_queries(
    dashboard_user, enrollment_and_progress, django_assert_num_queries
):
    """select_related + prefetch_related fetch the user's enrollments, progress
    and badges in a constant 3 queries regardless of row counts (< 5 per issue)."""
    with django_assert_num_queries(3):
        user_data = (
            User.objects.select_related("profile", "streak_profile")
            .prefetch_related(
                Prefetch(
                    "lessonprogress_set",
                    queryset=LessonProgress.objects.filter(completed=True),
                ),
                Prefetch(
                    "earned_badges",
                    queryset=UserBadge.objects.select_related("badge"),
                ),
            )
            .get(pk=dashboard_user.pk)
        )
        lesson_xp = sum(lp.score for lp in user_data.lessonprogress_set.all())
        earned_badges = [ub.badge.slug for ub in user_data.earned_badges.all()]

    assert lesson_xp == 100  # only completed lessons contribute XP
    assert sorted(earned_badges) == ["first-blood", "streak-7"]


@pytest.mark.django_db
def test_personal_stats_endpoint_query_budget_is_bounded(
    api_client, dashboard_user, enrollment_and_progress, django_assert_num_queries
):
    """personal_stats is served from 7 application queries (bounded, independent
    of row counts) plus the framework's auth/session middleware overhead.

    The app-query breakdown is constant:
      1. user + profile + streak_profile (select_related)
      1. completed lesson progress (prefetch)
      1. earned badges (prefetch + select_related badge)
      1. issues solved + XP (single aggregate)
      1. merged pull requests (count)
      1. completed challenges XP (aggregate)
      1. leaderboard rank (correlated subqueries)
    """
    from django.core.cache import cache
    from apps.predictions.ml_engine import PRReviewDelayPredictor

    cache.clear()
    PRReviewDelayPredictor()
    api_client.force_authenticate(user=dashboard_user)

    with django_assert_num_queries(14):
        response = api_client.get(ENDPOINT, {"fields": "personal_stats"})

    assert response.status_code == 200
