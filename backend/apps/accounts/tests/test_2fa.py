from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import TOTPDevice
from apps.accounts.totp import generate_totp_code, generate_totp_secret

User = get_user_model()


class TwoFactorAuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="totpuser", email="totp@example.com", password="Password123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_2fa_status_disabled_by_default(self):
        resp = self.client.get("/api/auth/2fa/status/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_enabled"])
        self.assertEqual(resp.data["backup_codes_remaining"], 0)

    def test_2fa_setup_generates_secret_and_backup_codes(self):
        resp = self.client.post("/api/auth/2fa/setup/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("secret", resp.data)
        self.assertIn("otpauth_url", resp.data)
        self.assertEqual(len(resp.data["backup_codes"]), 10)

        device = TOTPDevice.objects.get(user=self.user)
        self.assertFalse(device.is_enabled)
        self.assertEqual(len(device.backup_codes), 10)

    def test_verify_setup_with_invalid_code_fails(self):
        self.client.post("/api/auth/2fa/setup/")
        resp = self.client.post("/api/auth/2fa/verify-setup/", {"code": "000000"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"], "invalid_code")

        device = TOTPDevice.objects.get(user=self.user)
        self.assertFalse(device.is_enabled)

    def test_verify_setup_with_valid_totp_code(self):
        self.client.post("/api/auth/2fa/setup/")
        device = TOTPDevice.objects.get(user=self.user)

        valid_code = generate_totp_code(device.secret)
        resp = self.client.post("/api/auth/2fa/verify-setup/", {"code": valid_code})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_enabled"])

        device.refresh_from_db()
        self.assertTrue(device.is_enabled)

    def test_login_flow_enforces_2fa(self):
        # Enable 2FA for user
        secret = generate_totp_secret()
        device = TOTPDevice.objects.create(
            user=self.user,
            secret=secret,
            is_enabled=True,
            backup_codes=[],
        )

        self.client.logout()

        # Step 1: Login without 2FA code -> requires 2FA
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "totpuser", "password": "Password123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(resp.data.get("requires_2fa"))

        # Step 2: Login with invalid 2FA code -> fails
        resp = self.client.post(
            "/api/auth/login/",
            {
                "username": "totpuser",
                "password": "Password123!",
                "totp_code": "999999",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("totp_code", resp.data)

        # Step 3: Login with valid TOTP code -> succeeds
        valid_code = generate_totp_code(secret)
        resp = self.client.post(
            "/api/auth/login/",
            {
                "username": "totpuser",
                "password": "Password123!",
                "totp_code": valid_code,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_with_backup_code_consumes_code(self):
        # Setup 2FA with backup codes
        setup_resp = self.client.post("/api/auth/2fa/setup/")
        backup_codes = setup_resp.data["backup_codes"]
        device = TOTPDevice.objects.get(user=self.user)

        valid_code = generate_totp_code(device.secret)
        self.client.post("/api/auth/2fa/verify-setup/", {"code": valid_code})

        self.client.logout()

        # Use first backup code to log in
        backup_code = backup_codes[0]
        resp = self.client.post(
            "/api/auth/login/",
            {
                "username": "totpuser",
                "password": "Password123!",
                "totp_code": backup_code,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Ensure backup code was consumed (remaining count is 9)
        device.refresh_from_db()
        self.assertEqual(len(device.backup_codes), 9)

        # Attempt reuse of same backup code -> fails
        self.client.logout()
        resp_reuse = self.client.post(
            "/api/auth/login/",
            {
                "username": "totpuser",
                "password": "Password123!",
                "totp_code": backup_code,
            },
            format="json",
        )
        self.assertEqual(resp_reuse.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_disable_2fa_with_password(self):
        setup_resp = self.client.post("/api/auth/2fa/setup/")
        device = TOTPDevice.objects.get(user=self.user)
        valid_code = generate_totp_code(device.secret)
        self.client.post("/api/auth/2fa/verify-setup/", {"code": valid_code})

        # Wrong password -> fails
        resp_wrong = self.client.post(
            "/api/auth/2fa/disable/", {"password": "WrongPassword!"}
        )
        self.assertEqual(resp_wrong.status_code, status.HTTP_400_BAD_REQUEST)

        # Correct password -> succeeds
        resp_correct = self.client.post(
            "/api/auth/2fa/disable/", {"password": "Password123!"}
        )
        self.assertEqual(resp_correct.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_correct.data["is_enabled"])
        self.assertFalse(TOTPDevice.objects.filter(user=self.user).exists())
