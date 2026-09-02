import logging

from .tasks import (
    index_model_for_search,
    reconcile_search_index,
    remove_model_from_search,
)
from .utils import sanitize_index_text

logger = logging.getLogger(__name__)


def sanitize_index_payload(
    title: str, body_text: str = "", description: str = "", tags: str = ""
) -> dict:
    """
    Sanitizes title, description, tags, and body_text before indexing.
    """
    return {
        "title": sanitize_index_text(title),
        "description": sanitize_index_text(description),
        "tags": sanitize_index_text(tags),
        "body_text": sanitize_index_text(body_text),
    }


__all__ = [
    "sanitize_index_text",
    "sanitize_index_payload",
    "index_model_for_search",
    "remove_model_from_search",
    "reconcile_search_index",
]
