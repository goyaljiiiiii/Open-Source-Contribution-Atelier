import unittest
from unittest.mock import MagicMock, patch

from scripts.verify_staging_deployment import StagingDeploymentVerifier


class TestStagingDeploymentVerifier(unittest.TestCase):
    def setUp(self):
        self.verifier = StagingDeploymentVerifier(
            base_url="http://testserver", timeout=5, retries=1, delay=0
        )

    @patch("urllib.request.urlopen")
    def test_run_all_checks_healthy(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'{"status": "healthy", "database": "ok"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        success = self.verifier.run_all_checks()

        self.assertTrue(success)
        self.assertEqual(self.verifier.results["overall_status"], "HEALTHY")
        self.assertEqual(self.verifier.results["summary"]["passed"], 3)
        self.assertEqual(self.verifier.results["summary"]["failed"], 0)

    @patch("urllib.request.urlopen")
    def test_readiness_fails_on_db_down(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'{"status": "unhealthy", "database": "down"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        is_ready = self.verifier.check_readiness()

        self.assertFalse(is_ready)
        self.assertFalse(self.verifier.results["checks"]["readiness"]["passed"])

    @patch("urllib.request.urlopen")
    def test_liveness_fails_on_connection_error(self, mock_urlopen):
        mock_urlopen.side_effect = Exception("Connection refused")

        is_live = self.verifier.check_liveness()

        self.assertFalse(is_live)
        self.assertFalse(self.verifier.results["checks"]["liveness"]["passed"])
        self.assertIn("Connection refused", self.verifier.results["checks"]["liveness"]["error"])


if __name__ == "__main__":
    unittest.main()
