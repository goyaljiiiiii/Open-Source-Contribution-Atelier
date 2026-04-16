from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()
SANDBOX_URL = "/api/challenges/sandbox/execute/"

# Override throttle rates for testing so tests run fast
@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {
            "sandbox_anon": "10/minute",
            "sandbox_user": "10/minute",
        },
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticatedOrReadOnly",
        ),
    }
)
class SandboxAnonymousThrottleTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_allowed_within_limit(self):
        """First 10 requests must all return 200."""
        for i in range(10):
            response = self.client.post(
                SANDBOX_URL,
                {"code": "print('hello')", "language": "python"},
                format="json",
            )
            self.assertEqual(
                response.status_code, status.HTTP_200_OK,
                msg=f"Request {i+1} failed with {response.status_code}"
            )

    def test_anonymous_blocked_after_limit(self):
        """11th request must return HTTP 429."""
        for _ in range(10):
            self.client.post(
                SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
            )
        response = self.client.post(
            SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_429_has_structured_error(self):
        """429 response must contain type=rate_limit_exceeded."""
        for _ in range(10):
            self.client.post(
                SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
            )
        response = self.client.post(
            SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data.get("type"), "rate_limit_exceeded")


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {
            "sandbox_anon": "10/minute",
            "sandbox_user": "10/minute",
        },
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        ),
        "DEFAULT_PERMISSION_CLASSES": (
            "rest_framework.permissions.IsAuthenticatedOrReadOnly",
        ),
    }
)
class SandboxAuthenticatedThrottleTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_authenticated_blocked_after_limit(self):
        """Authenticated user also capped at 10 req/min."""
        for _ in range(10):
            self.client.post(
                SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
            )
        response = self.client.post(
            SANDBOX_URL, {"code": "x", "language": "python"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
