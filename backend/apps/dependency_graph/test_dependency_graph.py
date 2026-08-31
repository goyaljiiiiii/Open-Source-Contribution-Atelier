import pytest
from django.apps import apps

from apps.dependency_graph.apps import DependencyGraphConfig
from apps.dependency_graph.exporters.mermaid import MermaidExporter
from apps.dependency_graph.graph_generator import generate_dependency_graph


@pytest.mark.django_db
def test_dependency_graph_app_installed():
    assert apps.is_installed("apps.dependency_graph")
    assert DependencyGraphConfig.name == "apps.dependency_graph"
    assert DependencyGraphConfig.label == "dependency_graph"


@pytest.mark.django_db
def test_dependency_graph_generator():
    graph_data = generate_dependency_graph()
    assert isinstance(graph_data, (dict, list, str))


def test_mermaid_exporter_sanitizes_scoped_package_names():
    graph_data = {
        "nodes": [
            {"id": "@babel/core", "label": "@babel/core"},
            {"id": "@types/react", "label": "@types/react"},
            {"id": "lodash", "label": "lodash"},
        ],
        "edges": [
            {"source": "@babel/core", "target": "@types/react"},
            {"source": "@types/react", "target": "lodash"},
        ],
    }

    result = MermaidExporter().export(graph_data)

    assert 'node_babel_core["@babel/core"]' in result
    assert 'node_types_react["@types/react"]' in result
    assert "node_babel_core --> node_types_react" in result
    assert "node_types_react --> node_lodash" in result
    assert "@babel/core -->" not in result
    assert "@types/react -->" not in result
