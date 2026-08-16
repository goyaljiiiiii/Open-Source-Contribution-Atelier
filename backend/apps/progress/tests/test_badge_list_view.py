import pytest
from rest_framework.test import APIClient

from apps.progress.models import Badge


@pytest.mark.django_db
class TestBadgeListView:
    def setup_method(self):
        self.client = APIClient()
        # Create badges with different categories and names
        self.badge1 = Badge.objects.create(
            name="Alpha Contributor",
            slug="alpha-contributor",
            description="First contributor badge",
            category="git",
        )
        self.badge2 = Badge.objects.create(
            name="Beta Reviewer",
            slug="beta-reviewer",
            description="Reviewer badge",
            category="review",
        )
        self.badge3 = Badge.objects.create(
            name="Gamma Builder",
            slug="gamma-builder",
            description="Builder badge",
            category="git",
        )

    def test_badge_list_paginated_response_structure(self):
        response = self.client.get("/api/progress/badges/")
        assert response.status_code == 200
        assert "count" in response.data
        assert "next" in response.data
        assert "previous" in response.data
        assert "results" in response.data
        assert response.data["count"] == 3
        # Should be ordered by name ascending
        names = [b["name"] for b in response.data["results"]]
        assert names == ["Alpha Contributor", "Beta Reviewer", "Gamma Builder"]

    def test_badge_list_category_filter(self):
        response = self.client.get("/api/progress/badges/?category=git")
        assert response.status_code == 200
        assert response.data["count"] == 2
        names = [b["name"] for b in response.data["results"]]
        assert names == ["Alpha Contributor", "Gamma Builder"]

    def test_badge_list_search_filter(self):
        response = self.client.get("/api/progress/badges/?search=Reviewer")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Beta Reviewer"

    def test_badge_list_pagination_page_size(self):
        response = self.client.get("/api/progress/badges/?page_size=2")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2
        assert response.data["next"] is not None
