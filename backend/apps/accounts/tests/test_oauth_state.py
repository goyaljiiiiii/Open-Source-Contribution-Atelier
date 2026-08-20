from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.views import GitHubOAuthCallbackView

User = get_user_model()


class OAuthStateValidationTests(TestCase):
    @override_settings(
        GITHUB_CLIENT_ID="client-id",
        GITHUB_CLIENT_SECRET="client-secret",
    )
    def test_missing_state_is_rejected_with_400(self):
        response = APIClient().get(
            "/api/auth/github/callback/?code=authorization-code"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Missing state parameter.")

    @override_settings(
        GITHUB_CLIENT_ID="client-id",
        GITHUB_CLIENT_SECRET="client-secret",
    )
    def test_mismatched_state_is_rejected_with_400(self):
        client = APIClient()
        session = client.session
        session["github_oauth_state"] = {
            "value": "expected-state",
            "created_at": __import__("time").time(),
        }
        session["github_oauth_verifier"] = "verifier"
        session.save()

        response = client.get(
            "/api/auth/github/callback/?code=authorization-code&state=attacker-state"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid OAuth state.")

    @override_settings(
        GITHUB_CLIENT_ID="client-id",
        GITHUB_CLIENT_SECRET="client-secret",
    )
    def test_expired_state_is_rejected_with_400(self):
        client = APIClient()
        session = client.session
        session["github_oauth_state"] = {
            "value": "expected-state",
            "created_at": __import__("time").time() - 601,
        }
        session["github_oauth_verifier"] = "verifier"
        session.save()

        response = client.get(
            "/api/auth/github/callback/?code=authorization-code&state=expected-state"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "OAuth state expired.")

    @override_settings(
        GITHUB_CLIENT_ID="client-id",
        GITHUB_CLIENT_SECRET="client-secret",
    )
    @patch("apps.accounts.views.http_requests.post")
    def test_valid_state_reaches_token_exchange(self, mock_post):
        mock_post.return_value.json.return_value = {
            "access_token": "github-access-token"
        }
        mock_post.return_value.raise_for_status.return_value = None

        client = APIClient()
        session = client.session
        session["github_oauth_state"] = {
            "value": "expected-state",
            "created_at": __import__("time").time(),
        }
        session["github_oauth_verifier"] = "verifier"
        session.save()

        # The test only asserts that state validation succeeds and the flow
        # reaches GitHub's token endpoint; downstream GitHub API calls are
        # intentionally outside this regression test's scope.
        with patch("apps.accounts.views.http_requests.get") as mock_get:
            mock_get.return_value.json.return_value = {
                "login": "oauth-user",
                "email": "oauth@example.com",
            }
            mock_get.return_value.raise_for_status.return_value = None
            response = client.get(
                "/api/auth/github/callback/?code=authorization-code&state=expected-state"
            )

        self.assertNotEqual(response.status_code, 400)
        mock_post.assert_called_once()
