from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import requests
from django.conf import settings

from .base import VCSAdapter
from .dto import VCSProfileDTO

logger = logging.getLogger(__name__)


class GitLabAdapter(VCSAdapter):
    """
    Analyzes GitLab profiles to extract skills, experience, and activity.
    """

    GITLAB_API_URL = "https://gitlab.com/api/v4"

    def __init__(self, token: str | None = None):
        super().__init__(token)
        self.token = self.token or getattr(settings, "GITLAB_TOKEN", None)
        self.headers = {}
        if self.token:
            self.headers["PRIVATE-TOKEN"] = self.token
        else:
            logger.warning(
                "GITLAB_TOKEN is missing. Requests will be unauthenticated and subject to strict rate limits."
            )

    def analyze_user(self, username: str) -> VCSProfileDTO:
        user_data = self._get_user_data(username)
        if not user_data:
            return VCSProfileDTO(username=username, provider="gitlab")

        user_id = user_data.get("id")
        repos = self._get_user_repos(user_id) if user_id else []
        
        # GitLab API doesn't easily expose language breakdown per repo without extra calls,
        # but for compatibility we will try to approximate or extract if available
        languages = self._extract_languages(repos)
        commits = self._get_total_commits(user_data)
        commit_patterns = self._analyze_commit_patterns(repos)
        skill_levels = self._determine_skill_levels(languages, commit_patterns)
        frameworks = self._extract_frameworks(repos)
        contributions = self._get_contributions(user_data)
        years_experience = self._calculate_experience(user_data)

        return VCSProfileDTO(
            username=user_data.get("username", username),
            provider="gitlab",
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
                f"{self.GITLAB_API_URL}/users", 
                headers=self.headers,
                params={"username": username}
            )
            response.raise_for_status()
            data = response.json()
            if data and isinstance(data, list):
                return data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get GitLab user data for {username}: {e}")
            return None

    def _get_user_repos(self, user_id: int) -> list[dict]:
        repos = []
        page = 1
        while True:
            try:
                response = requests.get(
                    f"{self.GITLAB_API_URL}/users/{user_id}/projects",
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
                logger.error(f"Failed to get GitLab repos for user {user_id}: {e}")
                break
        return repos

    def _extract_languages(self, repos: list[dict]) -> dict[str, int]:
        # GitLab projects might not directly expose 'language' uniformly like GitHub.
        # But they have 'topics' and we can try to guess.
        languages = {}
        for repo in repos:
            # We'll just map topics or known metadata for now
            # as a placeholder since GitLab language stats require per-project API calls.
            topics = repo.get("tag_list", []) or repo.get("topics", [])
            for t in topics:
                t = t.lower()
                if t in ["python", "javascript", "typescript", "java", "ruby", "go", "c++"]:
                    languages[t] = languages.get(t, 0) + 1
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
            topics = repo.get("tag_list", []) or repo.get("topics", [])

            for framework, patterns in framework_patterns.items():
                for pattern in patterns:
                    if (
                        pattern in repo_name
                        or pattern in repo_desc
                        or any(pattern in str(topic).lower() for topic in topics)
                    ) and framework not in frameworks:
                        frameworks.append(framework)

        return frameworks

    def _get_total_commits(self, user_data: dict) -> int:
        return 0  # Approximation

    def _analyze_commit_patterns(self, repos: list[dict]) -> dict[str, Any]:
        return {
            "recent_activity": 0,
            "diversity": 1,
            "project_size": 0,
        }

    def _determine_skill_levels(
        self, languages: dict[str, int], patterns: dict[str, Any]
    ) -> dict[str, str]:
        skill_levels = {}
        if languages:
            primary_lang = max(languages, key=languages.get)
            for lang in languages:
                if lang == primary_lang:
                    skill_levels[lang] = "intermediate"
                else:
                    skill_levels[lang] = "beginner"
        return skill_levels

    def _get_contributions(self, user_data: dict) -> int:
        return 0  # Approximation

    def _calculate_experience(self, user_data: dict) -> float:
        created_at = user_data.get("created_at")
        if created_at:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            now = datetime.now(created.tzinfo) if created.tzinfo else datetime.now()
            years = (now - created).days / 365.25
            return max(0.0, years)
        return 0.0
