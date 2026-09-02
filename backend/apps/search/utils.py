from django.core.cache import cache


def get_search_cache_version():
    """
    Retrieves the current search cache version.
    Defaults to 1 if not set.
    """
    return cache.get("search_api_version", 1)


def bump_search_cache_version():
    """
    Increments the search cache version.
    This effectively invalidates all existing search caches
    without requiring a wildcard deletion.
    """
    try:
        cache.incr("search_api_version")
    except ValueError:
        cache.set("search_api_version", 1)


import re

STOP_WORDS = {
    "a",
    "an",
    "the",
    "and",
    "or",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "it",
    "this",
    "that",
    "are",
    "be",
    "as",
    "from",
    "into",
    "over",
    "after",
    "about",
    "your",
    "my",
    "our",
    "all",
    "how",
    "what",
    "where",
    "when",
    "why",
    "who",
    "which",
}


def sanitize_index_text(text: str) -> str:
    """
    Sanitizes search index text by stripping non-alphanumeric code symbols,
    filtering out common stop words, and normalizing whitespace.
    """
    if not text:
        return ""
    # Strip non-alphanumeric code symbols (replace with space to prevent concatenating words)
    cleaned = re.sub(r"[^\w\s]", " ", str(text))
    # Split into words and filter out stop words (case-insensitive)
    words = [word for word in cleaned.split() if word.lower() not in STOP_WORDS]
    # Normalize whitespace
    return " ".join(words)
