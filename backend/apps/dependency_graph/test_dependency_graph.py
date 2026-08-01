import pytest
from django.apps import apps
from apps.dependency_graph.apps import DependencyGraphConfig
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
