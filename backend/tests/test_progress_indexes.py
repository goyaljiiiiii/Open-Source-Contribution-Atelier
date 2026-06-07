import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.content.models import Lesson
from apps.progress.models import LessonProgress


@pytest.mark.django_db
class TestLessonProgressIndexes:
    """Verify that LessonProgress Meta defines the expected indexes and constraints."""

    def _get_model_index_names(self):
        return [idx.name for idx in LessonProgress._meta.indexes]

    def _get_model_constraint_names(self):
        return [c.name for c in LessonProgress._meta.constraints]

    def test_unique_user_lesson_constraint_exists(self):
        constraint_names = self._get_model_constraint_names()
        assert "unique_user_lesson_progress" in constraint_names

    def test_user_completed_index_exists(self):
        index_names = self._get_model_index_names()
        assert "idx_progress_user_completed" in index_names

    def test_user_score_index_exists(self):
        index_names = self._get_model_index_names()
        assert "idx_progress_user_score" in index_names

    def test_unique_constraint_enforced(self):
        """Inserting a duplicate (user, lesson) pair raises IntegrityError."""
        user = User.objects.create_user(username="dup_user")
        lesson = Lesson.objects.create(
            title="Dup Lesson",
            slug="dup-lesson",
            summary="s",
            content="c",
            order=1,
        )
        LessonProgress.objects.create(user=user, lesson=lesson, completed=False)

        from django.db import IntegrityError

        with pytest.raises(IntegrityError):
            # completed differs intentionally — uniqueness is on (user, lesson) alone
            LessonProgress.objects.create(user=user, lesson=lesson, completed=True)

    def test_user_completed_filter_query_count(self):
        """Filtering on (user, completed) should execute in a single query.

        Note: this tests ORM query count, not actual index usage at the
        database level.  Index presence is covered by the Meta inspection
        tests above.
        """
        user = User.objects.create_user(username="idx_user")
        lesson_a = Lesson.objects.create(
            title="A", slug="a", summary="s", content="c", order=1,
        )
        lesson_b = Lesson.objects.create(
            title="B", slug="b", summary="s", content="c", order=2,
        )
        LessonProgress.objects.create(user=user, lesson=lesson_a, completed=True, score=10)
        LessonProgress.objects.create(user=user, lesson=lesson_b, completed=False, score=5)

        with CaptureQueriesContext(connection) as ctx:
            results = list(
                LessonProgress.objects.filter(user=user, completed=True)
            )

        assert len(results) == 1
        assert results[0].lesson == lesson_a
        # Should be exactly 1 SELECT query
        assert len(ctx.captured_queries) == 1

    def test_no_unique_together_on_meta(self):
        """Confirm the deprecated unique_together has been removed."""
        assert LessonProgress._meta.unique_together == ()
