import time
from pathlib import Path

from django.test import TestCase, override_settings

from apps.sandbox.tasks import cleanup_expired_sandbox_sessions


class CleanupExpiredSandboxSessionsTests(TestCase):
    def setUp(self):
        self.base_dir = Path(self.enterContext_tempdir())

    def enterContext_tempdir(self):
        import tempfile

        tmp_ctx = tempfile.TemporaryDirectory()
        self.addCleanup(tmp_ctx.cleanup)
        return tmp_ctx.name

    def _make_session_dir(self, name, age_hours):
        session_dir = self.base_dir / name
        session_dir.mkdir(parents=True)
        (session_dir / "workspace_file.py").write_text("print('hello')")

        old_time = time.time() - (age_hours * 3600)
        import os

        os.utime(session_dir, (old_time, old_time))
        return session_dir

    def test_purges_only_expired_session_directories(self):
        expired_dir = self._make_session_dir("expired-session", age_hours=25)
        active_dir = self._make_session_dir("active-session", age_hours=1)

        with override_settings(SANDBOX_SESSIONS_DIR=str(self.base_dir)):
            result = cleanup_expired_sandbox_sessions()

        self.assertFalse(expired_dir.exists())
        self.assertTrue(active_dir.exists())
        self.assertEqual(result["cleaned_count"], 1)
        self.assertGreater(result["freed_bytes"], 0)

    def test_missing_sessions_dir_is_a_no_op(self):
        missing_dir = self.base_dir / "does-not-exist"

        with override_settings(SANDBOX_SESSIONS_DIR=str(missing_dir)):
            result = cleanup_expired_sandbox_sessions()

        self.assertEqual(result["cleaned_count"], 0)