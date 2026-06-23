from django.test import TestCase
from django.contrib.auth.models import User

class DummyTests(TestCase):
    def test_user_creation(self):
        User.objects.create_user(username="testuser", password="password123")
