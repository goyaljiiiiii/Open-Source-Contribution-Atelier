"""
Custom DRF exception handler that produces user-friendly 429 responses.

Returns a clear JSON body instead of the generic DRF throttle message,
so the frontend can display helpful error messages.
"""

from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler

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
    Wraps the default DRF exception handler to produce richer 429 responses.

    Response body:
    {
        "error": "rate_limited",
        "message": "<human readable string>",
        "retry_after": <seconds until limit resets, or null>
    }
    """
    response = exception_handler(exc, context)

    if isinstance(exc, Throttled):
        view = context.get("view")
        scope = None

        # Try to determine which throttle scope fired
        if view and hasattr(view, "throttle_classes"):
            for throttle_class in view.throttle_classes:
                if hasattr(throttle_class, "scope"):
                    scope = throttle_class.scope
                    break

        message = _THROTTLE_MESSAGES.get(scope, _DEFAULT_MESSAGE)
        retry_after = exc.wait  # seconds remaining, may be None

        return Response(
            {
                "error": "rate_limited",
                "message": message,
                "retry_after": int(retry_after) if retry_after else None,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return response
