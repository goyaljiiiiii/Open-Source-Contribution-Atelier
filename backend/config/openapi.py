from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import OpenApiResponse
from rest_framework import status

from apps.core.serializers import (
    StandardErrorSerializer,
    ValidationErrorSerializer,
    AuthenticationErrorSerializer,
    RateLimitErrorSerializer,
)


class ThrottleAutoSchema(AutoSchema):
    """
    Custom AutoSchema to automatically document common HTTP error responses
    (400, 401, 403, 404, 429) for all API endpoints.
    
    - 400: Validation errors (field-level)
    - 401: Authentication required or failed
    - 403: Permission denied
    - 404: Resource not found
    - 429: Rate limit exceeded (added if throttles are present)
    """

    def get_responses(self):
        responses = super().get_responses()

        # Standard 403 Forbidden response
        if "403" not in responses:
            responses["403"] = OpenApiResponse(
                response=StandardErrorSerializer,
                description="Forbidden - You do not have permission to access this resource.",
            )

        # Standard 404 Not Found response
        if "404" not in responses:
            responses["404"] = OpenApiResponse(
                response=StandardErrorSerializer,
                description="Not Found - The requested resource does not exist.",
            )

        # Standard 400 Bad Request response
        if "400" not in responses:
            responses["400"] = OpenApiResponse(
                response=ValidationErrorSerializer,
                description="Bad Request - The request is invalid or malformed.",
            )

        # Standard 401 Unauthorized response
        if "401" not in responses:
            responses["401"] = OpenApiResponse(
                response=AuthenticationErrorSerializer,
                description="Unauthorized - Authentication credentials are required or invalid.",
            )

        # Check if the view uses throttles
        get_throttles = getattr(self.view, "get_throttles", None)
        if get_throttles and get_throttles():
            if "429" not in responses:
                responses["429"] = OpenApiResponse(
                    response=RateLimitErrorSerializer,
                    description="Too Many Requests - Rate limit exceeded.",
                )

        return responses