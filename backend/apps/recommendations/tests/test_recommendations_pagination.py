import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.recommendations.models import Recommendation

User = get_user_model()


@pytest.mark.django_db
class TestRecommendationListPagination:
    def test_recommendation_list_returns_paginated_envelope(self):
        user = User.objects.create_user(username="rec_user", password="password")
        client = APIClient()
        client.force_authenticate(user=user)

        for i in range(25):
            Recommendation.objects.create(
                user=user,
                content_type="lesson",
                content_id=f"lesson-{i}",
                title=f"Recommendation {i}",
                reason="Testing",
                priority_score=100 - i,
            )

        response = client.get("/api/recommendations/")
        assert response.status_code == 200
        assert "count" in response.data
        assert "next" in response.data
        assert "results" in response.data
        assert response.data["count"] == 25
        assert len(response.data["results"]) == 20
