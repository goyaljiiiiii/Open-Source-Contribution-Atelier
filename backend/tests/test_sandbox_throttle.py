from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()
SANDBOX_URL = "/api/challenges/sandbox/execute/"

class SandboxThrottleTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password")

    def test_anonymous_throttle(self):
        # First 10 requests pass
        for _ in range(10):
            response = self.client.post(SANDBOX_URL, {"code": "print(1)"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 11th request hits the limit
        response = self.client.post(SANDBOX_URL, {"code": "print(1)"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data['error'], "Rate limit exceeded.")
