from rest_framework import serializers


class StandardErrorSerializer(serializers.Serializer):
    """
    Standard error response serializer for common HTTP error codes.
    Used by drf-spectacular to document error responses in OpenAPI schema.

    Example:
        {
            "error": true,
            "code": "permission_denied",
            "message": "You do not have permission to perform this action."
        }
    """

    error = serializers.BooleanField(help_text="Indicates whether an error occurred")
    code = serializers.CharField(
        help_text="Machine-readable error code (e.g., 'permission_denied', 'not_found')"
    )
    message = serializers.CharField(help_text="Human-readable error message")


class ValidationErrorSerializer(serializers.Serializer):
    """
    Validation error response serializer for 400 Bad Request responses.
    Extends StandardErrorSerializer with field-level errors.

    Example:
        {
            "error": true,
            "code": "validation_error",
            "message": "Invalid email format",
            "errors": {
                "email": ["Enter a valid email address."]
            }
        }
    """

    error = serializers.BooleanField(help_text="Indicates whether an error occurred")
    code = serializers.CharField(
        help_text="Always 'validation_error' for this response type"
    )
    message = serializers.CharField(help_text="Primary validation error message")
    errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        help_text="Detailed field-level validation errors",
    )


class AuthenticationErrorSerializer(serializers.Serializer):
    """
    Authentication error response serializer for 401 Unauthorized responses.

    Example:
        {
            "error": true,
            "code": "authentication_required",
            "message": "Authentication credentials were not provided."
        }
    """

    error = serializers.BooleanField(help_text="Indicates whether an error occurred")
    code = serializers.CharField(
        help_text="Authentication error code (e.g., 'authentication_required', 'authentication_failed')"
    )
    message = serializers.CharField(
        help_text="Human-readable authentication error message"
    )


class RateLimitErrorSerializer(serializers.Serializer):
    """
    Rate limit error response serializer for 429 Too Many Requests responses.

    Example:
        {
            "error": "rate_limited",
            "code": "rate_limited",
            "message": "Request limit exceeded. Please wait before retrying.",
            "retry_after": 60
        }
    """

    error = serializers.CharField(
        help_text="Always 'rate_limited' for this response type"
    )
    code = serializers.CharField(
        help_text="Always 'rate_limited' for this response type"
    )
    message = serializers.CharField(help_text="Human-readable rate limit error message")
    retry_after = serializers.IntegerField(
        help_text="Number of seconds to wait before retrying the request"
    )
