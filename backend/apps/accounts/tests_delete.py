from apps.chat.models import Message
from apps.content.models import Comment, Lesson
from apps.notes.models import Note
from apps.progress.models import Certificate
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class SecureAccountDeleteTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="john_doe", email="john@example.com", password="pass"
        )
        self.lesson = Lesson.objects.create(
            title="Test", slug="test", content="content"
        )

        # PII data
        Note.objects.create(
            user=self.user, title="My Note", encrypted_content="enc", iv="iv"
        )
        Certificate.objects.create(user=self.user, course_name="Open Source")

        # Public data
        Comment.objects.create(
            user=self.user, lesson=self.lesson, content="Great lesson!"
        )
        Message.objects.create(user=self.user, room_id="general", content="Hello world")

    def test_secure_deletion(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete("/api/auth/me/delete/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify user still exists but is soft-deleted
        user = User.objects.get(username="john_doe")
        self.assertTrue(user.is_deleted)
        self.assertFalse(user.is_active)

        # Verify PII is preserved (not cascade-deleted)
        self.assertEqual(Note.objects.count(), 1)
        self.assertEqual(Certificate.objects.count(), 1)

        # Verify public contributions are anonymized, not deleted
        self.assertEqual(Comment.objects.count(), 1)
        self.assertEqual(Message.objects.count(), 1)

        comment = Comment.objects.first()
        message = Message.objects.first()

        self.assertEqual(comment.user.username, "anonymous_contributor")
        self.assertEqual(message.user.username, "anonymous_contributor")
        self.assertFalse(comment.user.is_active)

    def test_deletion_with_no_contributions_or_pii(self):
        # Create a fresh user with nothing attached (except auto-created profile)
        empty_user = User.objects.create_user(
            username="ghost", email="ghost@example.com", password="pass"
        )
        self.client.force_authenticate(user=empty_user)

        response = self.client.delete("/api/auth/me/delete/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify user still exists but is soft-deleted
        user = User.objects.get(username="ghost")
        self.assertTrue(user.is_deleted)
        self.assertFalse(user.is_active)

    def test_repeated_deletion_attempt(self):
        self.client.force_authenticate(user=self.user)
        response1 = self.client.delete("/api/auth/me/delete/")
        self.assertEqual(response1.status_code, status.HTTP_204_NO_CONTENT)

        # Second attempt should also return 204 (idempotent)
        response2 = self.client.delete("/api/auth/me/delete/")
        self.assertEqual(response2.status_code, status.HTTP_204_NO_CONTENT)
