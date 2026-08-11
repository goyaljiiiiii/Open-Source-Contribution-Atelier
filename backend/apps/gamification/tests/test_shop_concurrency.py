import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.test import APIClient
from rest_framework import status
from apps.gamification.models import ShopItem, Purchase
from apps.progress.models import XPEvent

User = get_user_model()


@pytest.mark.django_db
def test_purchase_prevents_overspending_with_insufficient_xp():
    """Verify that a user cannot purchase an item costing more XP than they have."""
    user = User.objects.create_user(username="buyer", password="password")

    # Give user 100 XP
    XPEvent.objects.create(
        user=user, source_type="bonus", source_id=1,
        base_points=100, multiplier=1.0, xp_delta=100,
    )

    item = ShopItem.objects.create(name="Expensive Item", cost=200, is_active=True)

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.post("/api/gamification/shop/purchase/", {"item_id": item.id}, format="json")
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Not enough XP" in res.data["error"]


@pytest.mark.django_db
def test_purchase_deducts_xp_correctly():
    """Verify XP is deducted after a successful purchase."""
    user = User.objects.create_user(username="buyer2", password="password")

    XPEvent.objects.create(
        user=user, source_type="bonus", source_id=1,
        base_points=500, multiplier=1.0, xp_delta=500,
    )

    item = ShopItem.objects.create(name="Cool Badge", cost=100, is_active=True)

    client = APIClient()
    client.force_authenticate(user=user)

    res = client.post("/api/gamification/shop/purchase/", {"item_id": item.id}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["success"] is True
    assert res.data["remaining_xp"] == 400

    # Verify XP balance in database
    total_xp = XPEvent.objects.filter(user=user).aggregate(total=Sum("xp_delta"))["total"]
    assert total_xp == 400

    # Verify purchase record
    assert Purchase.objects.filter(user=user, item=item).exists()


@pytest.mark.django_db
def test_second_purchase_rejected_when_balance_insufficient():
    """Simulate sequential purchases to verify balance re-check under transaction."""
    user = User.objects.create_user(username="buyer3", password="password")

    XPEvent.objects.create(
        user=user, source_type="bonus", source_id=1,
        base_points=150, multiplier=1.0, xp_delta=150,
    )

    item = ShopItem.objects.create(name="Badge A", cost=100, is_active=True)

    client = APIClient()
    client.force_authenticate(user=user)

    # First purchase succeeds (150 - 100 = 50 remaining)
    res1 = client.post("/api/gamification/shop/purchase/", {"item_id": item.id}, format="json")
    assert res1.status_code == status.HTTP_200_OK

    # Second purchase should fail (50 < 100)
    res2 = client.post("/api/gamification/shop/purchase/", {"item_id": item.id}, format="json")
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "Not enough XP" in res2.data["error"]
