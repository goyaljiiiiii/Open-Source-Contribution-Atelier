import time
from unittest.mock import patch

from django.test import Client, TestCase
from django.urls import reverse


class OAuthSecurityTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.callback_url = reverse("github-callback")

    def test_missing_state_returns_401(self):
        response = self.client.get(self.callback_url, {"code": "some-code"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Missing state parameter.")

    def test_invalid_session_state_returns_401(self):
        # State parameter is present, but no session state exists
        response = self.client.get(
            self.callback_url, {"code": "some-code", "state": "some-state"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "OAuth session expired or invalid.")

    def test_mismatched_state_returns_401(self):
        session = self.client.session
        session["github_oauth_state"] = {
            "value": "valid-state",
            "created_at": time.time(),
        }
        session["github_oauth_verifier"] = "valid-verifier"
        session.save()

        response = self.client.get(
            self.callback_url, {"code": "some-code", "state": "attacker-state"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid OAuth state.")

    def test_expired_state_returns_401(self):
        session = self.client.session
        # Set state created_at to 11 minutes ago (expired)
        session["github_oauth_state"] = {
            "value": "valid-state",
            "created_at": time.time() - 660,
        }
        session["github_oauth_verifier"] = "valid-verifier"
        session.save()

        response = self.client.get(
            self.callback_url, {"code": "some-code", "state": "valid-state"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "OAuth state expired.")

    def test_replay_attack_fails(self):
        session = self.client.session
        session["github_oauth_state"] = {
            "value": "valid-state",
            "created_at": time.time(),
        }
        session["github_oauth_verifier"] = "valid-verifier"
        session.save()

        # Mock requests so it doesn't try to hit GitHub
        with patch("apps.accounts.views.http_requests.post") as mock_post:
            with patch("apps.accounts.views.http_requests.get") as mock_get:
                mock_post.return_value.ok = True
                mock_post.return_value.json.return_value = {"access_token": "token"}

                mock_get.return_value.ok = True
                mock_get.return_value.json.return_value = {"email": "test@example.com"}

                # First request should succeed and pop the session state
                response = self.client.get(
                    self.callback_url, {"code": "some-code", "state": "valid-state"}
                )
                self.assertEqual(response.status_code, 302)

        # Second request with the same state should fail because state was popped
        response = self.client.get(
            self.callback_url, {"code": "some-code", "state": "valid-state"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "OAuth session expired or invalid.")

    def test_missing_pkce_verifier_returns_401(self):
        session = self.client.session
        session["github_oauth_state"] = {
            "value": "valid-state",
            "created_at": time.time(),
        }
        # Intentionally missing github_oauth_verifier
        session.save()

        response = self.client.get(
            self.callback_url, {"code": "some-code", "state": "valid-state"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "OAuth session expired or invalid.")
