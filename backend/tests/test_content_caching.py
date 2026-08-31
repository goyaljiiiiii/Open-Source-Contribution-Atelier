from unittest.mock import MagicMock

import pytest
from django.core.cache import cache

from apps.content.models import Lesson
from apps.content.views import get_active_lessons


@pytest.fixture(autouse=True)
def clear_cache_before_tests(monkeypatch):
    monkeypatch.setattr("apps.content.signals.encode", lambda text: None)
    monkeypatch.setattr(
        "apps.core.cache.stampede.stampede_protected_get_or_set",
        lambda key, generate_func, **kwargs: generate_func(),
    )
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db(transaction=True)
def test_active_lessons_caching():
    assert cache.get("active_lessons_list") is None

    # First call should populate the cache
    lessons = get_active_lessons()
    assert isinstance(lessons, list)
    assert len(lessons) == 0
    assert cache.get("active_lessons_list") is not None

    # Create a new lesson
    lesson = Lesson.objects.create(
        difficulty="beginner",
        title="Cache Test",
        slug="cache-test",
        summary="Cache summary",
        content="Cache content",
        estimated_minutes=10,
        order=1,
    )

    # transaction.on_commit requires actual commits to fire.
    # In transaction=True tests, .create() commits immediately.
    assert cache.get("active_lessons_list") is None

    # Fetch again to populate cache with 1 lesson
    lessons = get_active_lessons()
    assert len(lessons) == 1
    assert cache.get("active_lessons_list") is not None

    # Update lesson
    lesson.title = "Updated Title"
    lesson.save()

    # Cache should be cleared
    assert cache.get("active_lessons_list") is None

    # Fetch again to populate cache
    get_active_lessons()
    assert cache.get("active_lessons_list") is not None

    # Delete lesson
    lesson.delete()

    # Cache should be cleared
    assert cache.get("active_lessons_list") is None


def test_module_and_lesson_signal_cache_invalidation():
    from django.db.models.signals import post_delete, post_save

    from apps.content.models import Exercise, Lesson, Module, ModuleDraft
    from apps.content.signals import clear_curriculum_caches, invalidate_lesson_cache

    # Populate cache keys matching pathway_ordering_* and module_list_*
    cache.set("pathway_ordering_1", "path_data", 300)
    cache.set("module_list_123", "module_data", 300)
    cache.set("unrelated_key", "keep_me", 300)

    # Calling clear_curriculum_caches purges pathway_ordering_* and module_list_*
    clear_curriculum_caches()

    assert cache.get("pathway_ordering_1") is None
    assert cache.get("module_list_123") is None
    assert cache.get("unrelated_key") is None

    # Verify signal handlers are connected to Lesson, Module, ModuleDraft, Exercise for post_save and post_delete
    for model in [Lesson, Module, ModuleDraft, Exercise]:
        receivers_save = [
            r[1]() for r in post_save.receivers if r[1]() == invalidate_lesson_cache
        ]
        receivers_delete = [
            r[1]() for r in post_delete.receivers if r[1]() == invalidate_lesson_cache
        ]
        assert len(receivers_save) > 0, f"post_save signal not connected for {model}"
        assert (
            len(receivers_delete) > 0
        ), f"post_delete signal not connected for {model}"


from unittest.mock import MagicMock, patch


def test_purge_redis_cache_patterns_delete_pattern():
    from apps.content.signals import purge_redis_cache_patterns

    mock_delete_pattern = MagicMock()
    with patch.object(cache, "delete_pattern", mock_delete_pattern, create=True):
        purge_redis_cache_patterns(["pathway_ordering_*", "module_list_*"])

    assert mock_delete_pattern.call_count == 2
    mock_delete_pattern.assert_any_call("pathway_ordering_*")
    mock_delete_pattern.assert_any_call("module_list_*")
