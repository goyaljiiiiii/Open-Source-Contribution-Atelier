import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest import mock
from apps.uploads.models import UploadSession

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_complete_upload_revalidates_size_against_limit(api_client, tmp_path, django_user_model):
    user = django_user_model.objects.create_user(username="testuser", password="password")
    api_client.force_authenticate(user=user)

    size_in_bytes = 6 * 1024 * 1024

    session = UploadSession.objects.create(
        user=user,
        filename="test.png",
        upload_type="avatar",
        total_size=size_in_bytes,
        total_chunks=1,
        uploaded_chunks=[0],
        status=UploadSession.Status.UPLOADING,
    )

    temp_dir = tmp_path / "temp_upload"
    temp_dir.mkdir()

    with mock.patch("apps.uploads.models.UploadSession.get_temp_dir", return_value=str(temp_dir)):
        chunk_path = temp_dir / "0.part"
        chunk_path.write_bytes(b"x" * size_in_bytes)

        url = reverse("uploads:complete_upload", kwargs={"session_id": session.session_id})
        response = api_client.post(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "exceeds the 5MB limit" in response.data.get("error", "")

        session.refresh_from_db()
        assert session.status == UploadSession.Status.FAILED
