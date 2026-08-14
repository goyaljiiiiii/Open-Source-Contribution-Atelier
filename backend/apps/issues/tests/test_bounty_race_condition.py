import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.issues.models import Bounty

User = get_user_model()


@pytest.mark.django_db
def test_bounty_claim_atomic_locking():
    user1 = User.objects.create_user(username="claimer1", password="password")
    user2 = User.objects.create_user(username="claimer2", password="password")

    bounty = Bounty.objects.create(
        title="Fix race condition",
        description="Fix race condition in claim endpoint",
        xp_reward=100,
        status=Bounty.Status.OPEN,
    )

    client1 = APIClient()
    client1.force_authenticate(user=user1)

    client2 = APIClient()
    client2.force_authenticate(user=user2)

    # First user claims
    url = f"/api/issues/bounties/{bounty.id}/claim/"
    res1 = client1.post(url)
    assert res1.status_code == status.HTTP_200_OK

    # Second user attempts to claim already claimed bounty
    res2 = client2.post(url)
    assert res2.status_code == status.HTTP_400_BAD_REQUEST

    bounty.refresh_from_db()
    assert bounty.status == Bounty.Status.CLAIMED
    assert bounty.claimed_by == user1
