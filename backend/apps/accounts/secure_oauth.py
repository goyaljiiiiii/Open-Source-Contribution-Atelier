"""Security wrappers for social OAuth callbacks.

Django-allauth owns the Google social-login callback and performs its own
session-bound OAuth state validation. The custom GitHub callback predates
that flow, so this wrapper normalizes state failures to the RFC-required
400 response while preserving the existing validation and PKCE logic.
"""

from rest_framework import status
from rest_framework.response import Response

from .views import GitHubOAuthCallbackView


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
