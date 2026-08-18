from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class VCSProfileDTO:
    username: str
    provider: str
    name: str | None = None
    bio: str | None = None
    user_data: dict[str, Any] = field(default_factory=dict)
    languages: list[str] = field(default_factory=list)
    skill_levels: dict[str, str] = field(default_factory=dict)
    frameworks: list[str] = field(default_factory=list)
    total_commits: int = 0
    total_repos: int = 0
    contributions: int = 0
    years_experience: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "username": self.username,
            "provider": self.provider,
            "name": self.name,
            "bio": self.bio,
            "user_data": self.user_data,
            "languages": self.languages,
            "skill_levels": self.skill_levels,
            "frameworks": self.frameworks,
            "total_commits": self.total_commits,
            "total_repos": self.total_repos,
            "contributions": self.contributions,
            "years_experience": self.years_experience,
        }
