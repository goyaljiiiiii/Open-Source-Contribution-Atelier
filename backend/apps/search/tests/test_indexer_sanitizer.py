import pytest

from apps.search.indexer import sanitize_index_payload
from apps.search.utils import sanitize_index_text


def test_sanitize_index_text_strips_code_symbols():
    text = "def function_name(arg1, arg2) { return arg1 + arg2; }"
    sanitized = sanitize_index_text(text)
    assert "(" not in sanitized
    assert ")" not in sanitized
    assert "{" not in sanitized
    assert "}" not in sanitized
    assert ";" not in sanitized
    assert "+" not in sanitized
    assert "function_name" in sanitized


def test_sanitize_index_text_filters_stop_words():
    text = "How to use the def function in Python with Git"
    sanitized = sanitize_index_text(text)
    # Stop words "how", "to", "the", "in", "with" should be removed
    words = sanitized.split()
    assert "how" not in [w.lower() for w in words]
    assert "to" not in [w.lower() for w in words]
    assert "the" not in [w.lower() for w in words]
    assert "in" not in [w.lower() for w in words]
    assert "with" not in [w.lower() for w in words]
    # Meaningful terms remain
    assert "use" in words
    assert "def" in words
    assert "function" in words
    assert "Python" in words
    assert "Git" in words


def test_sanitize_index_text_normalizes_whitespace():
    text = "  python   django   {  rest   framework  }  "
    sanitized = sanitize_index_text(text)
    assert sanitized == "python django rest framework"


def test_sanitize_index_payload():
    payload = sanitize_index_payload(
        title="How to build {REST API} in Django",
        description="A complete guide to Django REST framework",
        tags="django, rest, api!",
        body_text="def get_queryset(): return Model.objects.all();",
    )
    assert "How" not in payload["title"]
    assert "to" not in payload["title"]
    assert "{" not in payload["title"]
    assert "build" in payload["title"]
    assert "REST" in payload["title"]
    assert "API" in payload["title"]
    assert "Django" in payload["title"]
