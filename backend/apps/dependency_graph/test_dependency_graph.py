import json
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from apps.dependency_graph.graph_generator import (
    CACHE_KEY_PREFIX,
    DEFAULT_CACHE_TIMEOUT,
    build_dependency_graph_cache_key,
    dependency_graph_cache_status,
    dependency_graph_health,
    dependency_manifest_fingerprint,
    dependency_manifest_paths,
    deserialize_dependency_graph,
    generate_dependency_graph,
    invalidate_after_repository_sync,
    invalidate_dependency_graph_cache,
    serialize_dependency_graph,
)


def test_dependency_graph_app_installed():
    from django.apps import apps
    from apps.dependency_graph.apps import DependencyGraphConfig

    assert apps.is_installed("apps.dependency_graph")
    assert DependencyGraphConfig.name == "apps.dependency_graph"
    assert DependencyGraphConfig.label == "dependency_graph"


def test_dependency_graph_generator_returns_json_safe_graph():
    graph_data = generate_dependency_graph(use_cache=False)

    assert isinstance(graph_data, dict)
    assert isinstance(graph_data.get("nodes"), list)
    assert isinstance(graph_data.get("edges"), list)
    assert isinstance(graph_data.get("total_apps"), int)
    assert isinstance(graph_data.get("total_edges"), int)


def test_serialization_is_deterministic():
    graph = {
        "nodes": [{"id": "b"}, {"id": "a"}],
        "edges": [{"source": "a", "target": "b"}],
        "metadata": {"dependencies": {"z", "a"}},
    }

    first = serialize_dependency_graph(graph)
    second = serialize_dependency_graph(graph)

    assert first == second
    assert deserialize_dependency_graph(first)["metadata"]["dependencies"] == ["a", "z"]


def test_deserialize_rejects_invalid_payloads():
    assert deserialize_dependency_graph(None) is None
    assert deserialize_dependency_graph("not-json") is None
    assert deserialize_dependency_graph("[]") is None
    assert deserialize_dependency_graph(123) is None


def test_cache_key_contains_namespace_and_fingerprint():
    key = build_dependency_graph_cache_key(
        fingerprint="abc123",
        namespace="test",
    )

    assert key == f"{CACHE_KEY_PREFIX}:test:abc123"


def test_cache_key_does_not_use_a_single_global_graph_key():
    key_one = build_dependency_graph_cache_key(
        fingerprint="repo-state-one",
        namespace="default",
    )
    key_two = build_dependency_graph_cache_key(
        fingerprint="repo-state-two",
        namespace="default",
    )

    assert key_one != key_two


def test_manifest_fingerprint_is_stable_without_file_changes():
    first = dependency_manifest_fingerprint()
    second = dependency_manifest_fingerprint()

    assert first == second
    assert len(first) == 32


def test_manifest_paths_are_sorted_and_unique():
    paths = dependency_manifest_paths()

    assert paths == sorted(set(paths))


def test_health_endpoint_contains_cache_diagnostics():
    health = dependency_graph_health()

    assert health["cache_key_prefix"] == CACHE_KEY_PREFIX
    assert isinstance(health["cache_timeout"], int)
    assert isinstance(health["manifest_count"], int)
    assert isinstance(health["cache_hit"], bool)
    assert len(health["fingerprint"]) == 32


@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator.DependencyGraphGenerator.build_graph")
@patch("apps.dependency_graph.graph_generator._repository_fingerprint")
def test_cache_hit_skips_expensive_graph_generation(
    fingerprint,
    build_graph,
    cache_get,
):
    fingerprint.return_value = "cached-state"
    cache_get.return_value = {
        "nodes": [{"id": "cached"}],
        "edges": [],
        "total_apps": 1,
        "total_edges": 0,
    }

    result = generate_dependency_graph()

    assert result["nodes"][0]["id"] == "cached"
    build_graph.assert_not_called()


@patch("apps.dependency_graph.graph_generator._cache_set_graph")
@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator.DependencyGraphGenerator.build_graph")
@patch("apps.dependency_graph.graph_generator._repository_fingerprint")
def test_cache_miss_generates_and_stores_graph(
    fingerprint,
    build_graph,
    cache_get,
    cache_set,
):
    fingerprint.return_value = "new-state"
    cache_get.return_value = None
    generated = {
        "nodes": [{"id": "fresh"}],
        "edges": [],
        "total_apps": 1,
        "total_edges": 0,
    }
    build_graph.return_value = generated

    result = generate_dependency_graph()

    assert result == generated
    build_graph.assert_called_once()
    cache_set.assert_called_once()


@patch("apps.dependency_graph.graph_generator._cache_set_graph")
@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator.DependencyGraphGenerator.build_graph")
@patch("apps.dependency_graph.graph_generator._repository_fingerprint")
def test_force_refresh_bypasses_cache(
    fingerprint,
    build_graph,
    cache_get,
    cache_set,
):
    fingerprint.return_value = "forced-state"
    cache_get.return_value = {
        "nodes": [{"id": "stale"}],
        "edges": [],
        "total_apps": 1,
        "total_edges": 0,
    }
    generated = {
        "nodes": [{"id": "fresh"}],
        "edges": [],
        "total_apps": 1,
        "total_edges": 0,
    }
    build_graph.return_value = generated

    result = generate_dependency_graph(force_refresh=True)

    assert result == generated
    cache_get.assert_not_called()
    cache_set.assert_called_once_with(
        f"{CACHE_KEY_PREFIX}:default:forced-state",
        serialize_dependency_graph(generated),
    )


@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator.DependencyGraphGenerator.build_graph")
def test_cache_can_be_disabled(cache_get, build_graph):
    generated = {
        "nodes": [],
        "edges": [],
        "total_apps": 0,
        "total_edges": 0,
    }
    build_graph.return_value = generated

    assert generate_dependency_graph(use_cache=False) == generated
    cache_get.assert_not_called()
    build_graph.assert_called_once()


@patch("apps.dependency_graph.graph_generator._get_cache_backend")
def test_invalidation_uses_redis_delete_pattern_when_available(get_backend):
    backend = Mock()
    backend.delete_pattern = Mock()
    backend.set = Mock()
    get_backend.return_value = backend

    assert invalidate_dependency_graph_cache() is True
    backend.delete_pattern.assert_called_once_with(f"{CACHE_KEY_PREFIX}:*")
    backend.set.assert_called_once()


@patch("apps.dependency_graph.graph_generator.invalidate_dependency_graph_cache")
def test_repository_sync_hook_delegates_to_cache_invalidation(invalidate):
    invalidate.return_value = True

    assert invalidate_after_repository_sync() is True
    invalidate.assert_called_once_with()


@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator._repository_fingerprint")
def test_cache_status_reports_miss(fingerprint, cache_get):
    fingerprint.return_value = "miss-state"
    cache_get.return_value = None

    status = dependency_graph_cache_status()

    assert status["hit"] is False
    assert status["fingerprint"] == "miss-state"
    assert status["timeout"] == DEFAULT_CACHE_TIMEOUT


@patch("apps.dependency_graph.graph_generator._cache_get_graph")
@patch("apps.dependency_graph.graph_generator._repository_fingerprint")
def test_cache_status_reports_hit(fingerprint, cache_get):
    fingerprint.return_value = "hit-state"
    cache_get.return_value = {
        "nodes": [],
        "edges": [],
        "total_apps": 0,
        "total_edges": 0,
    }

    status = dependency_graph_cache_status()

    assert status["hit"] is True
    assert status["fingerprint"] == "hit-state"


def test_cache_payload_round_trip_preserves_graph_shape():
    original = {
        "nodes": [
            {
                "id": "payments",
                "label": "Payments",
                "models": 2,
                "serializers": 1,
                "views": 4,
                "signals": 0,
                "tasks": 2,
                "urls": 1,
            }
        ],
        "edges": [{"source": "payments", "target": "accounts"}],
        "total_apps": 1,
        "total_edges": 1,
    }

    encoded = serialize_dependency_graph(original)
    decoded = deserialize_dependency_graph(encoded)

    assert decoded == original
    assert json.loads(encoded) == original


@pytest.mark.django_db
def test_cached_graph_matches_uncached_graph_shape():
    uncached = generate_dependency_graph(use_cache=False)
    cached = generate_dependency_graph(use_cache=True)

    assert cached.keys() == uncached.keys()
    assert cached["nodes"] == uncached["nodes"]
    assert cached["edges"] == uncached["edges"]
    assert cached["total_apps"] == uncached["total_apps"]
    assert cached["total_edges"] == uncached["total_edges"]


def test_cache_fingerprint_changes_when_manifest_metadata_changes(tmp_path):
    from apps.dependency_graph import graph_generator

    manifest = tmp_path / "package.json"
    manifest.write_text('{"dependencies":{"django":"x"}}', encoding="utf-8")

    with patch.object(
        graph_generator,
        "_manifest_paths",
        return_value=[manifest],
    ), patch.object(
        graph_generator.apps,
        "get_app_configs",
        return_value=[
            Mock(path=str(tmp_path), name="sample_app"),
        ],
    ):
        first = graph_generator._repository_fingerprint()

        manifest.write_text(
            '{"dependencies":{"django":"x","redis":"y"}}',
            encoding="utf-8",
        )

        # mtime resolution can be coarse on some filesystems; size is also
        # included in the fingerprint, so this remains deterministic.
        second = graph_generator._repository_fingerprint()

    assert first != second


def test_cache_fingerprint_tracks_package_manifest_names(tmp_path):
    from apps.dependency_graph import graph_generator

    package = tmp_path / "package.json"
    requirements = tmp_path / "requirements.txt"
    ignored = tmp_path / "README.md"

    package.write_text("{}", encoding="utf-8")
    requirements.write_text("Django", encoding="utf-8")
    ignored.write_text("docs", encoding="utf-8")

    paths = graph_generator._manifest_paths(tmp_path)

    assert package in paths
    assert requirements in paths
    assert ignored not in paths


def test_safe_mtime_handles_missing_file(tmp_path):
    from apps.dependency_graph import graph_generator

    assert graph_generator._safe_mtime(tmp_path / "missing.json") is None


def test_json_safe_converts_sets_and_tuples():
    from apps.dependency_graph import graph_generator

    value = {
        "set": {"b", "a"},
        "tuple": ("x", "y"),
        "list": [{"nested": {"z", "q"}}],
    }

    safe = graph_generator._json_safe(value)

    assert safe == {
        "set": ["a", "b"],
        "tuple": ["x", "y"],
        "list": [{"nested": ["q", "z"]}],
    }
