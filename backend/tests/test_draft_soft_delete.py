import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.cache.services.cache_manager import disable_cache_signals, enable_cache_signals
from apps.content.models import LessonDraft, ModuleDraft


@pytest.fixture(autouse=True)
def disable_cache_signals_for_tests():
    disable_cache_signals()
    yield
    enable_cache_signals()


@pytest.mark.django_db
def test_module_draft_soft_delete_and_restore():
    module = ModuleDraft.objects.create(
        title="Soft Delete Module",
        slug="soft-delete-module",
        description="Desc",
        order=1,
    )
    assert module.is_deleted is False
    assert module.deleted_at is None

    # Soft delete
    module.delete()
    module.refresh_from_db()

    assert module.is_deleted is True
    assert module.deleted_at is not None

    # Default manager should filter out soft-deleted
    assert ModuleDraft.objects.filter(pk=module.pk).exists() is False
    # all_objects manager should include soft-deleted
    assert ModuleDraft.all_objects.filter(pk=module.pk).exists() is True

    # Restore
    module.restore()
    module.refresh_from_db()

    assert module.is_deleted is False
    assert module.deleted_at is None
    assert ModuleDraft.objects.filter(pk=module.pk).exists() is True


@pytest.mark.django_db
def test_lesson_draft_soft_delete_and_restore():
    lesson = LessonDraft.objects.create(
        title="Soft Delete Lesson",
        slug="soft-delete-lesson",
        description="Desc",
        content="Content",
        order=1,
    )
    assert lesson.is_deleted is False
    assert lesson.deleted_at is None

    # Soft delete
    lesson.delete()
    lesson.refresh_from_db()

    assert lesson.is_deleted is True
    assert lesson.deleted_at is not None

    # Default manager should filter out soft-deleted
    assert LessonDraft.objects.filter(pk=lesson.pk).exists() is False
    assert LessonDraft.all_objects.filter(pk=lesson.pk).exists() is True

    # Restore
    lesson.restore()
    lesson.refresh_from_db()

    assert lesson.is_deleted is False
    assert lesson.deleted_at is None
    assert LessonDraft.objects.filter(pk=lesson.pk).exists() is True


@pytest.mark.django_db
def test_draft_restore_api_endpoint():
    client = APIClient()

    draft = LessonDraft.objects.create(
        title="API Restore Test",
        slug="api-restore-test",
        description="Desc",
        content="Content",
    )
    draft.delete()
    assert draft.is_deleted is True

    # Call REST restore endpoint /api/v1/content/drafts/<id>/restore/
    url = reverse("draft-restore", kwargs={"pk": draft.pk})
    response = client.post(url)

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == draft.pk

    draft.refresh_from_db()
    assert draft.is_deleted is False
    assert draft.deleted_at is None


@pytest.mark.django_db
def test_draft_restore_api_endpoint_404():
    client = APIClient()
    url = reverse("draft-restore", kwargs={"pk": 999999})
    response = client.post(url)
    assert response.status_code == status.HTTP_404_NOT_FOUND
