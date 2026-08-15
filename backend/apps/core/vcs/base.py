from __future__ import annotations

from abc import ABC, abstractmethod

from .dto import VCSProfileDTO


class VCSAdapter(ABC):
    """
    Abstract base class for all VCS provider integrations (GitHub, GitLab, etc.).
    """

    def __init__(self, token: str | None = None):
        self.token = token

    @abstractmethod
    def analyze_user(self, username: str) -> VCSProfileDTO:
        """
        Analyze a VCS user profile and extract standardized skill and activity data.

        Args:
            username: The username of the user on the VCS platform.

        Returns:
            VCSProfileDTO: Standardized user profile data.
        """
