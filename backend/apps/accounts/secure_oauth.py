"""Security wrappers for social OAuth callbacks.

Django-allauth owns the Google social-login callback and performs its own
session-bound OAuth state validation. The custom GitHub callback predates
that flow, so this wrapper normalizes state failures to the RFC-required
400 response while preserving the existing validation and PKCE logic.
"""

from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from apps.core.serializers import StandardErrorSerializer
from .serializers import OAuthTokenResponseSerializer
from .views import GitHubOAuthCallbackView


@extend_schema(
    operation_id="github_oauth_callback",
    description="GitHub OAuth callback endpoint. Handles the callback from GitHub after user authorization.",
    parameters=[],
    responses={
        200: OpenApiResponse(
            response=OAuthTokenResponseSerializer,
            description="OAuth authentication successful. Returns access and refresh tokens.",
        ),
        400: OpenApiResponse(
            response=StandardErrorSerializer,
            description="Invalid OAuth state, missing parameters, or authentication failed.",
        ),
        401: OpenApiResponse(
            response=StandardErrorSerializer,
            description="OAuth state validation failed or expired.",
        ),
    },
    tags=["Authentication"],
)
class SecureGitHubOAuthCallbackView(GitHubOAuthCallbackView):
    """Return HTTP 400 for invalid/missing/expired OAuth state."""

    def get(self, request):
        response = super().get(request)

        if getattr(response, "status_code", None) == status.HTTP_401_UNAUTHORIZED:
            return Response(
                response.data,
                status=status.HTTP_400_BAD_REQUEST,
                headers=getattr(response, "headers", None),
            )

        return response