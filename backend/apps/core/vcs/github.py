from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import requests
from django.conf import settings

from .base import VCSAdapter
from .dto import VCSProfileDTO

logger = logging.getLogger(__name__)


class GitHubAdapter(VCSAdapter):
    """
    Analyzes GitHub profiles to extract skills, experience, and activity.
    """

    GITHUB_API_URL = "https://api.github.com"

    def __init__(self, token: str | None = None):
        super().__init__(token)
        self.token = self.token or getattr(settings, "GITHUB_TOKEN", None)
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
        else:
            logger.warning(
                "GITHUB_TOKEN is missing. Requests will be unauthenticated and subject to strict rate limits."
            )

    def analyze_user(self, username: str) -> VCSProfileDTO:
        user_data = self._get_user_data(username)
        if not user_data:
            return VCSProfileDTO(username=username, provider="github")

        repos = self._get_user_repos(username)
        languages = self._extract_languages(repos)
        commits = self._get_total_commits(username, user_data)
        commit_patterns = self._analyze_commit_patterns(repos)
        skill_levels = self._determine_skill_levels(languages, commit_patterns)
        frameworks = self._extract_frameworks(repos)
        contributions = self._get_contributions(username, user_data)
        years_experience = self._calculate_experience(user_data)

        return VCSProfileDTO(
            username=user_data.get("login", username),
            provider="github",
            name=user_data.get("name"),
            bio=user_data.get("bio"),
            user_data=user_data,
            languages=list(languages.keys()),
            skill_levels=skill_levels,
            frameworks=frameworks,
            total_commits=commits,
            total_repos=len(repos),
            contributions=contributions,
            years_experience=years_experience,
        )

    def _get_user_data(self, username: str) -> dict | None:
        try:
            response = requests.get(
                f"{self.GITHUB_API_URL}/users/{username}", headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get GitHub user data for {username}: {e}")
            return None

    def _get_user_repos(self, username: str) -> list[dict]:
        repos = []
        page = 1
        while True:
            try:
                response = requests.get(
                    f"{self.GITHUB_API_URL}/users/{username}/repos",
                    headers=self.headers,
                    params={"page": page, "per_page": 100},
                )
                response.raise_for_status()
                data = response.json()
                if not data:
                    break
                repos.extend(data)
                page += 1
            except Exception as e:
                logger.error(f"Failed to get GitHub repos for {username}: {e}")
                break
        return repos

    def _extract_languages(self, repos: list[dict]) -> dict[str, int]:
        languages = {}
        for repo in repos:
            if repo.get("language"):
                lang = repo["language"]
                languages[lang] = languages.get(lang, 0) + 1
        return languages

    def _extract_frameworks(self, repos: list[dict]) -> list[str]:
        frameworks = []
        framework_patterns = {
            "react": ["react", "next.js", "gatsby"],
            "django": ["django", "drf"],
            "vue": ["vue", "nuxt"],
            "angular": ["angular"],
            "flask": ["flask"],
            "fastapi": ["fastapi"],
            "node": ["node", "express", "nestjs"],
            "spring": ["spring", "springboot"],
            "tensorflow": ["tensorflow", "keras"],
            "pytorch": ["pytorch"],
        }

        for repo in repos:
            repo_name = repo.get("name", "").lower()
            repo_desc = str(repo.get("description") or "").lower()
            topics = repo.get("topics", [])

            for framework, patterns in framework_patterns.items():
                for pattern in patterns:
                    if (
                        pattern in repo_name
                        or pattern in repo_desc
                        or any(pattern in topic for topic in topics)
                    ) and framework not in frameworks:
                        frameworks.append(framework)

        return frameworks

    def _get_total_commits(self, username: str, user_data: dict) -> int:
        return user_data.get("public_repos", 0) * 10  # Approximation

    def _analyze_commit_patterns(self, repos: list[dict]) -> dict[str, Any]:
        patterns = {
            "recent_activity": 0,
            "diversity": len(
                {repo.get("language") for repo in repos if repo.get("language")}
            ),
            "project_size": sum(1 for repo in repos if repo.get("size", 0) > 1000),
        }
        return patterns

    def _determine_skill_levels(
        self, languages: dict[str, int], patterns: dict[str, Any]
    ) -> dict[str, str]:
        skill_levels = {}
        if languages:
            primary_lang = max(languages, key=languages.get)
            for lang, count in languages.items():
                if lang == primary_lang:
                    if patterns.get("project_size", 0) > 10:
                        skill_levels[lang] = "expert"
                    elif patterns.get("project_size", 0) > 5:
                        skill_levels[lang] = "advanced"
                    elif patterns.get("project_size", 0) > 2:
                        skill_levels[lang] = "intermediate"
                    else:
                        skill_levels[lang] = "beginner"
                else:
                    if count > 5:
                        skill_levels[lang] = "intermediate"
                    else:
                        skill_levels[lang] = "beginner"
        return skill_levels

    def _get_contributions(self, username: str, user_data: dict) -> int:
        return user_data.get("public_repos", 0) * 5  # Approximation

    def _calculate_experience(self, user_data: dict) -> float:
        created_at = user_data.get("created_at")
        if created_at:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            # use timezone aware if possible, but simplified here
            now = datetime.now(created.tzinfo) if created.tzinfo else datetime.now()
            years = (now - created).days / 365.25
            return max(0.0, years)
        return 0.0
