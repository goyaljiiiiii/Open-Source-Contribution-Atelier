import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.ml_triage.views import ML_TRIAGE_THRESHOLD_CACHE_KEY


@pytest.mark.django_db
def test_threshold_accepts_boundary_values():
    user = get_user_model().objects.create_user(username="admin", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)

    for value in (0.0, 1.0):
        response = client.post(
            "/api/ml-triage/settings/threshold/", {"threshold": value}, format="json"
        )
        assert response.status_code == 200
        assert response.data["threshold"] == value
        assert cache.get(ML_TRIAGE_THRESHOLD_CACHE_KEY) == value


@pytest.mark.django_db
@pytest.mark.parametrize("value", [-0.1, 1.1])
def test_threshold_rejects_out_of_range_values(value):
    user = get_user_model().objects.create_user(username="admin", is_staff=True)
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/ml-triage/settings/threshold/", {"threshold": value}, format="json"
    )

    assert response.status_code == 400
    assert "threshold" in response.data or "threshold" in response.data.get("errors", {})


@pytest.mark.django_db
def test_threshold_requires_admin():
    user = get_user_model().objects.create_user(username="user", is_staff=False)
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/ml-triage/settings/threshold/", {"threshold": 0.5}, format="json"
    )

    assert response.status_code == 403
