from __future__ import annotations

from .base import VCSAdapter
from .github import GitHubAdapter
from .gitlab import GitLabAdapter


class VCSAdapterFactory:
    """
    Factory class to instantiate the correct VCSAdapter based on the provider name.
    """

    @staticmethod
    def get_adapter(provider: str, token: str | None = None) -> VCSAdapter:
        """
        Get the adapter for the given provider.

        Args:
            provider: The name of the VCS provider (e.g., 'github', 'gitlab').
            token: Optional authentication token. If not provided, the adapter 
                   will attempt to load it from Django settings.

        Returns:
            VCSAdapter instance.
        """
        provider = provider.lower()
        if provider == "github":
            return GitHubAdapter(token=token)
        elif provider == "gitlab":
            return GitLabAdapter(token=token)
        else:
            raise ValueError(f"Unknown VCS provider: {provider}")
