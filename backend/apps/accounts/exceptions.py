"""
Custom DRF exception handler that produces user-friendly API responses.
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import (
    Throttled,
    NotAuthenticated,
    AuthenticationFailed,
    ValidationError,
    PermissionDenied,
)
from rest_framework.response import Response
from rest_framework import status


# Map throttle scope names → human-readable messages
_THROTTLE_MESSAGES = {
    "auth_login": "Too many login attempts. Please wait a minute and try again.",
    "auth_signup": "Too many sign-up requests. Please try again later.",
    "auth_token_refresh": "Too many token refresh requests. Please slow down.",
    "auth_otp_generate": "Too many OTP requests. Please wait a few minutes before requesting a new code.",
    "auth_otp_verify": "Too many OTP verification attempts. Please wait before trying again.",
    "auth_password_reset": "Too many password reset requests. Please wait an hour before requesting another reset.",
    "auth_oauth": "Too many OAuth requests. Please wait a moment and try again.",
}

_DEFAULT_MESSAGE = "Request limit exceeded. Please wait before retrying."


def throttle_exception_handler(exc, context):
    """
    Custom DRF exception handler that standardizes API error responses.
    """

    response = exception_handler(exc, context)

    # Authentication required
    if isinstance(exc, NotAuthenticated):
        return Response(
            {
                "error": True,
                "code": "authentication_required",
                "message": str(exc.detail),
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Invalid credentials / authentication failure
    if isinstance(exc, AuthenticationFailed):
        return Response(
            {
                "error": True,
                "code": "authentication_failed",
                "message": str(exc.detail),
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Validation errors
    if isinstance(exc, ValidationError):
        message = "Validation error"

        if isinstance(exc.detail, dict):
            first_field = next(iter(exc.detail))
            first_error = exc.detail[first_field][0]
            message = str(first_error)
        elif isinstance(exc.detail, list):
            message = str(exc.detail[0])
        else:
            message = str(exc.detail)

        return Response(
            {
                "error": True,
                "code": "validation_error",
                "message": message,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if isinstance(exc, PermissionDenied):
        return Response(
            {
                "error": True,
                "code": "permission_denied",
                "message": str(exc.detail),
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    # Rate limiting
    if isinstance(exc, Throttled):
        view = context.get("view")
        scope = None

        if view and hasattr(view, "throttle_classes"):
            for throttle_class in view.throttle_classes:
                if hasattr(throttle_class, "scope"):
                    scope = throttle_class.scope
                    break

        message = _THROTTLE_MESSAGES.get(scope, _DEFAULT_MESSAGE)

        return Response(
            {
                "error": True,
                "code": "rate_limited",
                "message": message,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return response