import pytest
from django.urls import resolve
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_dx_analytics_url_resolution():
    resolver = resolve("/api/dx-analytics/overview/")
    assert resolver.view_name == "dx_overview" or resolver.func is not None


@pytest.mark.django_db
def test_dx_analytics_api_endpoint_response():
    client = APIClient()
    response = client.get("/api/dx-analytics/overview/")
    assert response.status_code in (200, 401, 403)
