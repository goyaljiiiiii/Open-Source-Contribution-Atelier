import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.progress.models import CodeSubmission, PeerReview, XPEvent

User = get_user_model()


@pytest.mark.django_db
def test_editing_peer_review_does_not_duplicate_xp():
    author = User.objects.create_user(username="author_user", password="password")
    reviewer = User.objects.create_user(username="reviewer_user", password="password")

    submission = CodeSubmission.objects.create(user=author, code="print('hello')", status="pending")
    submission.assigned_reviewers.add(reviewer)

    client = APIClient()
    client.force_authenticate(user=reviewer)

    # 1. Initial review submission
    url = f"/api/progress/code-submissions/{submission.id}/reviews/"
    res1 = client.post(url, {"is_approved": True, "feedback": "Great work!"}, format="json")
    assert res1.status_code == status.HTTP_201_CREATED

    initial_xp_count = XPEvent.objects.filter(user=reviewer, source_type="peer_review").count()
    assert initial_xp_count == 1

    # 2. Resubmit/edit review
    res2 = client.post(url, {"is_approved": True, "feedback": "Updated feedback!"}, format="json")
    assert res2.status_code == status.HTTP_200_OK

    updated_xp_count = XPEvent.objects.filter(user=reviewer, source_type="peer_review").count()
    assert updated_xp_count == 1
