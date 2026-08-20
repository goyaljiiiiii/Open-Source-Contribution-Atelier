from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.uploads.models import UploadSession

User = get_user_model()


@override_settings(TESTING=True)
class ChunkCompletionRaceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="upload-race-user",
            email="upload-race@example.com",
            password="test-password",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_completion_uses_part_files_when_json_bookkeeping_loses_a_chunk(self):
        session = UploadSession.objects.create(
            user=self.user,
            filename="payload.txt",
            upload_type=UploadSession.UploadType.PROJECT,
            total_size=6,
            total_chunks=3,
            uploaded_chunks=[0, 2],  # Simulates a lost concurrent update for chunk 1.
            status=UploadSession.Status.UPLOADING,
        )
        temp_dir = Path(session.get_temp_dir())
        (temp_dir / "0.part").write_bytes(b"aa")
        (temp_dir / "1.part").write_bytes(b"bb")
        (temp_dir / "2.part").write_bytes(b"cc")

        with patch("apps.uploads.views.validate_file", return_value=("text", "text/plain")), \
             patch("apps.uploads.views.enqueue_upload_scan") as enqueue_scan:
            response = self.client.post(
                f"/api/uploads/complete/{session.session_id}/"
            )

        self.assertEqual(response.status_code, 202)
        session.refresh_from_db()
        self.assertEqual(session.uploaded_chunks, [0, 1, 2])
        self.assertEqual(session.status, UploadSession.Status.QUARANTINED)
        enqueue_scan.assert_called_once_with(str(session.session_id))

    def test_completion_rejects_when_a_part_file_is_actually_missing(self):
        session = UploadSession.objects.create(
            user=self.user,
            filename="payload.txt",
            upload_type=UploadSession.UploadType.PROJECT,
            total_size=4,
            total_chunks=2,
            uploaded_chunks=[0, 1],
            status=UploadSession.Status.UPLOADING,
        )
        temp_dir = Path(session.get_temp_dir())
        (temp_dir / "0.part").write_bytes(b"aa")

        response = self.client.post(
            f"/api/uploads/complete/{session.session_id}/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Missing chunks")
        self.assertEqual(response.json()["uploaded"], [0])
