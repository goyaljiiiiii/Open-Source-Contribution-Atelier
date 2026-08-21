"""
Services for user accounts, authentication tokens, and password reset flows.
"""

from datetime import timedelta
import logging
from typing import Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import PasswordResetToken

logger = logging.getLogger(__name__)
User = get_user_model()

# Password reset token expiration lifetime: 15 minutes (900 seconds)
PASSWORD_RESET_TIMEOUT_SECONDS: int = getattr(
    settings, "PASSWORD_RESET_TIMEOUT_SECONDS", 900
)
PASSWORD_RESET_TIMEOUT_MINUTES: int = getattr(
    settings, "PASSWORD_RESET_TIMEOUT_MINUTES", 15
)


def create_password_reset_token(user) -> PasswordResetToken:
    """
    Generate a new single-use password reset token for the given user,
    invalidating any previously generated unused tokens.
    """
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
    reset_token = PasswordResetToken.objects.create(user=user)
    logger.info("Created password reset token for user_id=%s", user.id)
    return reset_token


def is_token_expired(
    reset_token: PasswordResetToken,
    timeout_seconds: int = PASSWORD_RESET_TIMEOUT_SECONDS,
) -> bool:
    """
    Return True if the token's creation timestamp exceeds the timeout threshold (15 minutes / 900s).
    """
    if not reset_token or not reset_token.created_at:
        return True
    return timezone.now() > reset_token.created_at + timedelta(seconds=timeout_seconds)


def validate_password_reset_token(
    token_value: str,
    timeout_seconds: int = PASSWORD_RESET_TIMEOUT_SECONDS,
) -> Tuple[bool, Optional[PasswordResetToken], Optional[str]]:
    """
    Validate a password reset token string.

    Returns:
        (is_valid, token_object, error_code_or_message)
    """
    try:
        reset_token = PasswordResetToken.objects.select_related("user").get(
            token=token_value,
            is_used=False,
        )
    except (PasswordResetToken.DoesNotExist, ValueError):
        return False, None, "invalid_token"

    if is_token_expired(reset_token, timeout_seconds=timeout_seconds):
        return False, reset_token, "expired_token"

    return True, reset_token, None


def redeem_password_reset_token(
    token_value: str,
    new_password: str,
    timeout_seconds: int = PASSWORD_RESET_TIMEOUT_SECONDS,
) -> Tuple[bool, Optional[str]]:
    """
    Redeem a password reset token and update the user's password.
    Rejects tokens that have expired past 15 minutes (900 seconds).

    Returns:
        (success, error_message)
    """
    is_valid, reset_token, error = validate_password_reset_token(
        token_value, timeout_seconds=timeout_seconds
    )
    if not is_valid or not reset_token:
        if error == "expired_token":
            return False, "Password reset link expired"
        return False, "This reset link is invalid or has already been used."

    user = reset_token.user
    user.set_password(new_password)
    if hasattr(user, "user_profile"):
        user.user_profile.last_password_change = timezone.now()
        user.user_profile.save(update_fields=["last_password_change"])
    user.save()

    # Mark all unused reset tokens for this user as redeemed
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
    logger.info("Successfully reset password for user_id=%s", user.id)
    return True, None
