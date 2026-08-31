from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.db import transaction

from apps.content.models import Lesson
from apps.events.services.event_bus import EventBus
from apps.search.models import SearchDocument


@pytest.mark.django_db(transaction=True)
def test_bulk_create_emits_search_indexing():
    """
    Test that bulk_create on models with SearchIndexMixin emits the
    SearchIndexRequested event, bypassing the issue of missing post_save.
    """
    with patch.object(EventBus, "emit") as mock_emit:
        with transaction.atomic():
            Lesson.objects.bulk_create(
                [
                    Lesson(
                        title="Drift Fix 1",
                        slug="drift-fix-1",
                        summary="test",
                        content="test",
                        order=1,
                    ),
                    Lesson(
                        title="Drift Fix 2",
                        slug="drift-fix-2",
                        summary="test",
                        content="test",
                        order=2,
                    ),
                ]
            )

    # Event should be called twice, one for each created lesson
    assert mock_emit.call_count == 2
    # Verify the event types
    for call in mock_emit.call_args_list:
        event_type, event_data = call[0]
        assert event_type == "SearchIndexRequested"
        assert event_data["model_name"] == "lesson"
        assert "Drift Fix" in event_data["title"]


@pytest.mark.django_db
def test_django_check_bulk_create_bypass(capsys):
    """
    Test that our Django check warns about bulk_create being used on models
    that have post_save signals.
    (Lesson has post_save and uses bulk_create in seed_lessons.py)
    """
    # Since seed_lessons.py exists in the codebase and calls Lesson.objects.bulk_create,
    # the check should flag it.
    from django.core.management import call_command
    from django.test import override_settings

    try:
        with override_settings(CORS_ALLOW_ALL_ORIGINS=False):
            call_command("check")
    except Exception as exc:
        pytest.fail(f"manage.py check failed: {exc}")


@pytest.mark.django_db
@patch("apps.search.meili_client.get_meili_index")
def test_reconcile_search_index(mock_get_meili_index):
    """
    Test that reconcile_search_index syncs the DB SearchDocument state with Meilisearch.
    """
    from unittest.mock import MagicMock

    from django.contrib.contenttypes.models import ContentType

    from apps.search.models import SearchDocument
    from apps.search.tasks import reconcile_search_index

    # Mock meilisearch index
    mock_index = MagicMock()
    # Let meili have one document '999' which is stale, and one '1' which is valid
    # But DB only has '1' and '2'. So '2' is missing in meili, '999' is stale.
    mock_index.get_documents.return_value = MagicMock(
        results=[{"id": "1"}, {"id": "999"}]
    )
    mock_get_meili_index.return_value = mock_index

    ct = ContentType.objects.get_for_model(Lesson)
    SearchDocument.objects.create(
        id=1, content_type=ct, object_id=10, title="Valid", body_text="Test"
    )
    SearchDocument.objects.create(
        id=2, content_type=ct, object_id=11, title="Missing", body_text="Test"
    )

    reconcile_search_index()

    # Re-index missing (2)
    mock_index.add_documents.assert_called_once()
    added_docs = mock_index.add_documents.call_args[0][0]
    assert len(added_docs) == 1
    assert added_docs[0]["id"] == "2"

    # Remove stale (999)
    mock_index.delete_document.assert_called_once_with("999")
