"""
Dependency graph generation with Redis-backed caching.

The graph is intentionally cached at the application boundary rather than
inside individual scanners. This keeps the scanners deterministic and makes
cache invalidation explicit and easy to integrate with repository-sync flows.
"""

from __future__ import annotations

import ast
import hashlib
import importlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from django.apps import apps
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "dependency_graph:v2"
DEFAULT_CACHE_TIMEOUT = 60 * 60
PACKAGE_MANIFEST_NAMES = frozenset(
    {
        "package.json",
        "requirements.txt",
        "requirements-dev.txt",
        "requirements-test.txt",
        "pyproject.toml",
        "Pipfile",
        "Pipfile.lock",
        "poetry.lock",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
    }
)


def _cache_timeout() -> int:
    """Return the configured dependency graph cache lifetime."""
    configured = getattr(settings, "DEPENDENCY_GRAPH_CACHE_TIMEOUT", DEFAULT_CACHE_TIMEOUT)
    try:
        return max(1, int(configured))
    except (TypeError, ValueError):
        return DEFAULT_CACHE_TIMEOUT


def _configured_namespace() -> str:
    """Return an optional deployment namespace for multi-tenant cache isolation."""
    value = os.getenv("DEPENDENCY_GRAPH_CACHE_NAMESPACE", "default")
    normalized = re.sub(r"[^a-zA-Z0-9_.-]", "-", value.strip())
    return normalized or "default"


def _safe_mtime(path: Path) -> Optional[Tuple[int, int]]:
    """Return nanosecond mtime and file size without failing graph generation."""
    try:
        stat = path.stat()
        return stat.st_mtime_ns, stat.st_size
    except OSError:
        return None


def _manifest_paths(app_path: Path) -> List[Path]:
    """Find dependency/package manifests below an application directory."""
    if not app_path.exists():
        return []

    found: List[Path] = []
    for candidate in app_path.rglob("*"):
        if not candidate.is_file():
            continue
        if candidate.name in PACKAGE_MANIFEST_NAMES:
            found.append(candidate)
    return sorted(found, key=lambda p: str(p))


def _repository_fingerprint() -> str:
    """
    Build a stable fingerprint from dependency configuration files.

    A graph generated from the same repository state receives the same cache
    key. Editing a package manifest naturally creates a new fingerprint, so
    stale graph payloads are bypassed even if an explicit invalidation hook is
    not invoked by a caller.
    """
    entries: List[str] = []
    seen: Set[str] = set()

    for app_config in apps.get_app_configs():
        try:
            app_path = Path(app_config.path).resolve()
        except OSError:
            continue

        for manifest in _manifest_paths(app_path):
            key = str(manifest)
            if key in seen:
                continue
            seen.add(key)
            metadata = _safe_mtime(manifest)
            if metadata is None:
                entries.append(f"{key}:missing")
            else:
                mtime_ns, size = metadata
                entries.append(f"{key}:{mtime_ns}:{size}")

    # Include the configured repository root when available. This lets
    # deployments invalidate all graph entries after a sync without needing
    # to know which individual app contained the changed manifest.
    repo_root = getattr(settings, "BASE_DIR", None)
    if repo_root:
        root = Path(repo_root).resolve()
        root_meta = _safe_mtime(root)
        entries.append(f"root:{root}:{root_meta}")

    digest = hashlib.sha256("\n".join(sorted(entries)).encode("utf-8")).hexdigest()
    return digest[:32]


def build_dependency_graph_cache_key(
    fingerprint: Optional[str] = None,
    namespace: Optional[str] = None,
) -> str:
    """Return the canonical Redis/Django-cache key for the current graph."""
    fp = fingerprint or _repository_fingerprint()
    ns = namespace or _configured_namespace()
    return f"{CACHE_KEY_PREFIX}:{ns}:{fp}"


def _cache_alias() -> str:
    """Return the configured cache alias, falling back to Django's default."""
    return getattr(settings, "DEPENDENCY_GRAPH_CACHE_ALIAS", "default")


def _get_cache_backend():
    """Resolve the configured cache backend."""
    try:
        from django.core.cache import caches

        return caches[_cache_alias()]
    except Exception:
        return cache


def invalidate_dependency_graph_cache() -> bool:
    """
    Invalidate all dependency graph cache entries.

    ``delete_pattern`` is used when supported by Redis-backed cache
    implementations. A version marker is also written so integrations that
    cannot enumerate keys can force a new namespace immediately.
    """
    backend = _get_cache_backend()
    deleted = False

    try:
        delete_pattern = getattr(backend, "delete_pattern", None)
        if callable(delete_pattern):
            delete_pattern(f"{CACHE_KEY_PREFIX}:*")
            deleted = True
    except Exception:
        logger.exception("Unable to delete dependency graph cache pattern")

    try:
        backend.set(
            f"{CACHE_KEY_PREFIX}:invalidation",
            hashlib.sha256(os.urandom(32)).hexdigest(),
            timeout=_cache_timeout(),
        )
        deleted = True
    except Exception:
        logger.exception("Unable to update dependency graph cache invalidation marker")

    return deleted


def _json_safe(value: Any) -> Any:
    """Convert sets and other graph values into deterministic JSON-safe data."""
    if isinstance(value, set):
        return sorted(_json_safe(item) for item in value)
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return value


def serialize_dependency_graph(graph: Dict[str, Any]) -> str:
    """Serialize a graph into deterministic JSON for Redis storage."""
    return json.dumps(
        _json_safe(graph),
        sort_keys=True,
        separators=(",", ":"),
    )


def deserialize_dependency_graph(payload: Any) -> Optional[Dict[str, Any]]:
    """Deserialize a cached graph, returning ``None`` for malformed entries."""
    if payload is None:
        return None

    try:
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        if isinstance(payload, str):
            value = json.loads(payload)
        elif isinstance(payload, dict):
            value = payload
        else:
            return None
    except (TypeError, ValueError, json.JSONDecodeError):
        return None

    return value if isinstance(value, dict) else None


class DependencyGraphGenerator:
    """Generate dependency graphs showing relationships between Django components."""

    def __init__(self):
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.apps_data: Dict[str, Dict[str, Any]] = {}

    def scan_all_apps(self) -> None:
        """Scan all eligible Django apps and their components."""
        for app_config in apps.get_app_configs():
            app_name = app_config.name
            if app_name.startswith("django.") or app_name.startswith("apps."):
                # The project historically excluded the apps.* namespace here.
                # Preserve that behavior so caching does not change graph shape.
                continue

            self.apps_data[app_name] = {
                "name": app_name,
                "label": app_config.verbose_name or app_name,
                "path": str(app_config.path),
                "models": [],
                "serializers": [],
                "views": [],
                "signals": [],
                "tasks": [],
                "urls": [],
                "dependencies": set(),
            }

            self._scan_models(app_name)
            self._scan_serializers(app_name)
            self._scan_views(app_name)
            self._scan_signals(app_name)
            self._scan_tasks(app_name)
            self._scan_urls(app_name)

    def _scan_models(self, app_name: str) -> None:
        """Scan model classes and foreign-key dependencies."""
        try:
            module = importlib.import_module(f"{app_name}.models")
            for name, obj in module.__dict__.items():
                if not hasattr(obj, "__module__"):
                    continue
                if obj.__module__ != f"{app_name}.models":
                    continue
                if not hasattr(obj, "_meta") or not hasattr(obj._meta, "model_name"):
                    continue

                self.apps_data[app_name]["models"].append(name)
                for field in obj._meta.get_fields():
                    if not getattr(field, "is_relation", False):
                        continue
                    related_model = getattr(field, "related_model", None)
                    if not related_model or not hasattr(related_model, "_meta"):
                        continue
                    related_app = related_model._meta.app_label
                    if related_app != app_name:
                        self.apps_data[app_name]["dependencies"].add(related_app)
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect models for %s", app_name, exc_info=True)

    def _scan_serializers(self, app_name: str) -> None:
        """Scan model serializers in an app."""
        try:
            module = importlib.import_module(f"{app_name}.serializers")
            for name, obj in module.__dict__.items():
                if getattr(obj, "__module__", None) != f"{app_name}.serializers":
                    continue
                if hasattr(obj, "Meta") and hasattr(obj.Meta, "model"):
                    self.apps_data[app_name]["serializers"].append(name)
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect serializers for %s", app_name, exc_info=True)

    def _scan_views(self, app_name: str) -> None:
        """Scan class-based and function-style views."""
        try:
            module = importlib.import_module(f"{app_name}.views")
            for name, obj in module.__dict__.items():
                if getattr(obj, "__module__", None) != f"{app_name}.views":
                    continue
                if hasattr(obj, "as_view") or hasattr(obj, "get"):
                    self.apps_data[app_name]["views"].append(name)
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect views for %s", app_name, exc_info=True)

    def _scan_signals(self, app_name: str) -> None:
        """Scan signal handlers defined by an app."""
        try:
            module = importlib.import_module(f"{app_name}.signals")
            for name, obj in module.__dict__.items():
                if getattr(obj, "__module__", None) == f"{app_name}.signals":
                    self.apps_data[app_name]["signals"].append(name)
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect signals for %s", app_name, exc_info=True)

    def _scan_tasks(self, app_name: str) -> None:
        """Scan Celery tasks defined by an app."""
        try:
            module = importlib.import_module(f"{app_name}.tasks")
            for name, obj in module.__dict__.items():
                if getattr(obj, "__module__", None) != f"{app_name}.tasks":
                    continue
                if hasattr(obj, "delay") or hasattr(obj, "apply_async"):
                    self.apps_data[app_name]["tasks"].append(name)
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect tasks for %s", app_name, exc_info=True)

    def _scan_urls(self, app_name: str) -> None:
        """Scan an app's URL configuration."""
        try:
            module = importlib.import_module(f"{app_name}.urls")
            if hasattr(module, "urlpatterns"):
                self.apps_data[app_name]["urls"].append("urlpatterns")
        except (ImportError, AttributeError, RuntimeError):
            logger.debug("Unable to inspect URLs for %s", app_name, exc_info=True)

    def _build_nodes(self) -> List[Dict[str, Any]]:
        """Build stable node records from scanned app metadata."""
        nodes: List[Dict[str, Any]] = []
        for app_name in sorted(self.apps_data):
            data = self.apps_data[app_name]
            nodes.append(
                {
                    "id": app_name,
                    "label": data["label"],
                    "models": len(data["models"]),
                    "serializers": len(data["serializers"]),
                    "views": len(data["views"]),
                    "signals": len(data["signals"]),
                    "tasks": len(data["tasks"]),
                    "urls": len(data["urls"]),
                }
            )
        return nodes

    def _build_edges(self) -> List[Dict[str, Any]]:
        """Build stable dependency edges."""
        edges: List[Dict[str, Any]] = []
        known_apps = set(self.apps_data)
        for app_name in sorted(self.apps_data):
            for dependency in sorted(self.apps_data[app_name]["dependencies"]):
                if dependency in known_apps:
                    edges.append({"source": app_name, "target": dependency})
        return edges

    def build_graph(self) -> Dict[str, Any]:
        """Build a dependency graph without consulting the cache."""
        self.scan_all_apps()
        nodes = self._build_nodes()
        edges = self._build_edges()

        graph = {
            "nodes": nodes,
            "edges": edges,
            "total_apps": len(nodes),
            "total_edges": len(edges),
        }
        self.nodes = nodes
        self.edges = edges
        return graph


def _cache_get_graph(key: str) -> Optional[Dict[str, Any]]:
    """Read and validate a cached graph payload."""
    backend = _get_cache_backend()
    try:
        return deserialize_dependency_graph(backend.get(key))
    except Exception:
        logger.exception("Dependency graph cache read failed")
        return None


def _cache_set_graph(key: str, graph: Dict[str, Any]) -> bool:
    """Write a graph payload to the configured Django cache."""
    backend = _get_cache_backend()
    try:
        backend.set(key, serialize_dependency_graph(graph), timeout=_cache_timeout())
        return True
    except Exception:
        # A cache outage must never make dependency graph generation fail.
        logger.exception("Dependency graph cache write failed")
        return False


def generate_dependency_graph(
    *,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Generate or retrieve the dependency graph.

    ``use_cache`` can be disabled for diagnostics and administrative refreshes.
    ``force_refresh`` bypasses a cache hit and replaces the current payload.
    Cache failures degrade gracefully to the original graph-generation path.
    """
    key = build_dependency_graph_cache_key()

    if use_cache and not force_refresh:
        cached = _cache_get_graph(key)
        if cached is not None:
            return cached

    graph = DependencyGraphGenerator().build_graph()

    if use_cache:
        _cache_set_graph(key, graph)

    return graph


def refresh_dependency_graph_cache() -> Dict[str, Any]:
    """Force regeneration and storage of the current dependency graph."""
    return generate_dependency_graph(use_cache=True, force_refresh=True)


def dependency_graph_cache_status() -> Dict[str, Any]:
    """Return cache diagnostics without exposing the graph payload."""
    key = build_dependency_graph_cache_key()
    cached = _cache_get_graph(key)
    return {
        "key": key,
        "hit": cached is not None,
        "timeout": _cache_timeout(),
        "namespace": _configured_namespace(),
        "fingerprint": _repository_fingerprint(),
    }


def dependency_manifest_paths() -> List[str]:
    """Return the manifest files contributing to the current cache fingerprint."""
    paths: Set[str] = set()
    for app_config in apps.get_app_configs():
        try:
            app_path = Path(app_config.path)
        except OSError:
            continue
        for manifest in _manifest_paths(app_path):
            paths.add(str(manifest))
    return sorted(paths)


def dependency_manifest_fingerprint() -> str:
    """Public wrapper used by sync integrations and operational diagnostics."""
    return _repository_fingerprint()


def invalidate_after_repository_sync() -> bool:
    """
    Explicit invalidation hook for repository synchronization.

    Sync code should call this after package manifests have been written. The
    fingerprint mechanism still protects against stale entries if a caller
    forgets to invoke this hook.
    """
    return invalidate_dependency_graph_cache()


def _parse_python_imports(path: Path) -> Set[str]:
    """Parse top-level Python imports from a source file."""
    imports: Set[str] = set()
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError, UnicodeDecodeError):
        return imports

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    return imports


def dependency_graph_health() -> Dict[str, Any]:
    """Return lightweight health information useful to monitoring endpoints."""
    manifests = dependency_manifest_paths()
    status = dependency_graph_cache_status()
    return {
        "cache_key_prefix": CACHE_KEY_PREFIX,
        "cache_timeout": status["timeout"],
        "manifest_count": len(manifests),
        "cache_hit": status["hit"],
        "fingerprint": status["fingerprint"],
    }


__all__ = [
    "CACHE_KEY_PREFIX",
    "DEFAULT_CACHE_TIMEOUT",
    "DependencyGraphGenerator",
    "build_dependency_graph_cache_key",
    "dependency_graph_cache_status",
    "dependency_graph_health",
    "dependency_manifest_fingerprint",
    "dependency_manifest_paths",
    "generate_dependency_graph",
    "invalidate_after_repository_sync",
    "invalidate_dependency_graph_cache",
    "refresh_dependency_graph_cache",
    "serialize_dependency_graph",
    "deserialize_dependency_graph",
]
