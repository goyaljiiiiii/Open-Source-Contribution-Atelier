import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.billing.models import SubscriptionPlan, CustomerSubscription

User = get_user_model()


@pytest.mark.django_db
def test_plan_list_view():
    client = APIClient()
    SubscriptionPlan.objects.create(
        name="Pro Plan",
        stripe_price_id="price_pro_123",
        price=19.99,
        interval="month"
    )
    response = client.get("/api/billing/plans/")
    assert response.status_code == 200
    assert len(response.data) >= 1
    assert response.data[0]["name"] == "Pro Plan"


@pytest.mark.django_db
def test_checkout_session_unauthenticated():
    client = APIClient()
    response = client.post("/api/billing/checkout/", {"plan_id": 1})
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_checkout_session_plan_not_found():
    user = User.objects.create_user(username="billing_user", password="password123")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/billing/checkout/", {"plan_id": 99999})
    assert response.status_code == 404
    assert response.data["error"] == "Plan not found"


@pytest.mark.django_db
def test_checkout_session_mock_mode():
    user = User.objects.create_user(username="billing_mock_user", password="password123")
    plan = SubscriptionPlan.objects.create(
        name="Enterprise Plan",
        stripe_price_id="price_ent_123",
        price=99.99,
        interval="month"
    )
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/billing/checkout/", {"plan_id": plan.id})
    assert response.status_code == 200
    assert "checkout_url" in response.data
    assert "success=true" in response.data["checkout_url"]
