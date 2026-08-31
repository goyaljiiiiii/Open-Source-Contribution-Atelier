from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import PasswordResetToken
from apps.accounts.services import (
    PASSWORD_RESET_TIMEOUT_SECONDS,
    create_password_reset_token,
    is_token_expired,
    redeem_password_reset_token,
    validate_password_reset_token,
)

User = get_user_model()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        username="reset_user",
        email="reset_user@example.com",
        password="OldSecurePassword123!",
    )


@pytest.mark.django_db
class TestPasswordResetExpiration:
    def test_token_valid_within_15_minutes(self, test_user):
        """Tokens created under 15 minutes ago should be recognized as valid."""
        token = create_password_reset_token(test_user)
        assert not is_token_expired(token)
        assert not token.is_expired()

        is_valid, token_obj, err = validate_password_reset_token(str(token.token))
        assert is_valid is True
        assert token_obj.id == token.id
        assert err is None

    def test_token_expired_after_15_minutes(self, test_user):
        """Tokens older than 15 minutes (900 seconds) must be expired and rejected."""
        token = create_password_reset_token(test_user)

        # Fast forward creation time by 15 minutes and 1 second (901 seconds)
        token.created_at = timezone.now() - timedelta(
            seconds=PASSWORD_RESET_TIMEOUT_SECONDS + 1
        )
        token.save(update_fields=["created_at"])

        assert is_token_expired(token) is True
        assert token.is_expired() is True

        is_valid, token_obj, err = validate_password_reset_token(str(token.token))
        assert is_valid is False
        assert err == "expired_token"

    def test_redeem_expired_token_fails(self, test_user):
        """Redeeming an expired token fails with appropriate error message."""
        token = create_password_reset_token(test_user)
        token.created_at = timezone.now() - timedelta(minutes=16)
        token.save(update_fields=["created_at"])

        success, err_msg = redeem_password_reset_token(
            str(token.token), "NewSecurePassword456!"
        )
        assert success is False
        assert "expired" in err_msg.lower()

    def test_redeem_valid_token_success(self, test_user):
        """Redeeming a fresh token successfully updates the user password."""
        token = create_password_reset_token(test_user)

        success, err_msg = redeem_password_reset_token(
            str(token.token), "NewSecurePassword456!"
        )
        assert success is True
        assert err_msg is None

        test_user.refresh_from_db()
        assert test_user.check_password("NewSecurePassword456!") is True

    def test_api_confirm_rejects_expired_token(self, test_user):
        """API endpoint /api/auth/password-reset/confirm/ rejects expired tokens with 400 Bad Request."""
        token = create_password_reset_token(test_user)
        token.created_at = timezone.now() - timedelta(minutes=20)
        token.save(update_fields=["created_at"])

        client = APIClient()
        response = client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": str(token.token),
                "new_password": "BrandNewPassword789!",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data.get("error") == "expired_token"
        assert "expired" in data.get("message", "").lower()
