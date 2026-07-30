import base64
import hashlib
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import GitCredential
from apps.core.fields import decrypt_value, encrypt_value

User = get_user_model()


class EncryptionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="testuser", email="test@test.com")
        # Ensure we have a valid key for testing
        settings.FIELD_ENCRYPTION_KEY = ["MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="]

    def test_nonce_uniqueness(self):
        # Same plaintext should yield different ciphertexts
        plaintext = "my_super_secret_token"
        cred1 = GitCredential.objects.create(user=self.user, token=plaintext)
        cred2 = GitCredential.objects.create(user=self.user, token=plaintext)

        # We must pull raw values from DB to bypass from_db_value
        cred1_raw = GitCredential.objects.values_list("token", flat=True).get(
            id=cred1.id
        )
        cred2_raw = GitCredential.objects.values_list("token", flat=True).get(
            id=cred2.id
        )

        self.assertNotEqual(cred1_raw, cred2_raw)
        self.assertNotEqual(cred1_raw, plaintext)

        # But they decrypt to the same value
        self.assertEqual(cred1.token, plaintext)
        self.assertEqual(cred2.token, plaintext)

    def test_key_rotation(self):
        plaintext = "password123"
        cred = GitCredential.objects.create(user=self.user, password=plaintext)

        old_key = settings.FIELD_ENCRYPTION_KEY[0]
        # New key for rotation (valid base64)
        new_key = "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY="

        # Set double read key list (new key primary, old key secondary)
        settings.FIELD_ENCRYPTION_KEY = [new_key, old_key]

        # The credential should still be decryptable because old_key is in the list
        cred.refresh_from_db()
        self.assertEqual(cred.password, plaintext)

        old_raw = GitCredential.objects.values_list("password", flat=True).get(
            id=cred.id
        )

        # Run the rotation command
        call_command("rotate_encryption_key", rotate_key=True)

        cred.refresh_from_db()
        self.assertEqual(cred.password, plaintext)

        new_raw = GitCredential.objects.values_list("password", flat=True).get(
            id=cred.id
        )

        # The ciphertext should have changed after rotation
        self.assertNotEqual(old_raw, new_raw)

        # Now drop the old key completely and it should still work
        settings.FIELD_ENCRYPTION_KEY = [new_key]
        cred.refresh_from_db()
        self.assertEqual(cred.password, plaintext)

    def test_search_by_hash(self):
        plaintext = "searchable_token"
        GitCredential.objects.create(user=self.user, token=plaintext)

        expected_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()

        # We should be able to look it up by the hash
        found = GitCredential.objects.filter(token_hash=expected_hash).exists()
        self.assertTrue(found)

    def test_repr_and_str(self):
        plaintext = "sensitive_password"
        cred = GitCredential(user=self.user, password=plaintext)

        # Plaintext should NOT appear in str or repr
        self.assertNotIn(plaintext, str(cred))
        self.assertNotIn(plaintext, repr(cred))
        self.assertIn("GitCredential", repr(cred))

    def test_fallback_unencrypted_data(self):
        # Test that fields that are not prefixed with "enc:" are returned as-is
        # This simulates reading pre-migration data
        self.assertEqual(decrypt_value("plain_old_token"), "plain_old_token")
