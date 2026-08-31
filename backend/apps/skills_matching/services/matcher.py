"""
ML-based skill matching for contributors and issues.
"""

import logging
from typing import Any, Dict, List, Optional

import numpy as np

from apps.ml_triage.models import Issue
from apps.skills_matching.models import (
    ContributorProfile,
    NewcomerFriendlinessScore,
    Recommendation,
)
from apps.skills_matching.services.skill_tagger import SkillTagger

logger = logging.getLogger(__name__)

# A zero-confidence skill is treated as an optional preference. It should not
# penalize a contributor who does not have the skill, but a match can still
# provide a small amount of credit.
OPTIONAL_SKILL_WEIGHT = 0.1


class SkillMatcher:
    """
    Match contributors with issues based on skills.
    """

    def __init__(self):
        self.skill_tagger = SkillTagger()

    def match_contributor_to_issues(
        self, contributor: ContributorProfile, limit: int = 10
    ) -> List[Recommendation]:
        """
        Match a contributor with suitable issues.

        Recommendations are ranked by the existing ``combined_score`` so the
        newcomer-friendliness weighting remains part of the final ordering.
        """
        issues = Issue.objects.filter(
            state="open", predicted_category__in=["bug", "feature"]
        )

        recommendations = []

        for issue in issues:
            score = self._calculate_match_score(contributor, issue)

            if score > 0.3:
                friendliness = self._get_friendliness_score(issue)

                issue_skills = self.skill_tagger.get_required_skills(issue)
                contributor_skills = contributor.skill_levels

                matched = []
                missing = []

                for skill_info in issue_skills:
                    skill_name = skill_info["skill"]
                    if skill_name in contributor_skills:
                        matched.append(skill_name)
                    else:
                        missing.append(skill_name)

                combined_score = score * 0.6 + friendliness * 0.4

                recommendation = Recommendation.objects.create(
                    contributor=contributor,
                    issue=issue,
                    match_score=score * 100,
                    friendliness_score=friendliness * 100,
                    combined_score=combined_score * 100,
                    matched_skills=matched,
                    missing_skills=missing,
                    reasoning=self._generate_reasoning(matched, missing, score),
                )

                recommendations.append(recommendation)

        # Keep the product's existing ranking semantics: combined_score
        # includes both skill match and newcomer friendliness.
        recommendations.sort(key=lambda r: r.combined_score, reverse=True)

        contributor.total_recommendations += len(recommendations)
        contributor.save()

        return recommendations[:limit]

    def _calculate_match_score(
        self, contributor: ContributorProfile, issue: Issue
    ) -> float:
        """
        Calculate match score between contributor and issue.

        Positive-confidence skills are weighted by their confidence.
        Zero-confidence skills are optional: they do not reduce the score when
        missing, while a contributor who has one receives a small optional
        credit. This prevents an optional tag from making a valid candidate
        disappear from the recommendation set.
        """
        issue_skills = self.skill_tagger.get_required_skills(issue)
        contributor_skills = contributor.skill_levels

        if not issue_skills:
            return 0.5

        weighted_match = 0.0
        total_weight = 0.0

        for skill_info in issue_skills:
            skill_name = skill_info["skill"]
            confidence = max(0.0, float(skill_info.get("confidence", 0.0)))

            if confidence == 0.0:
                # Optional preferences are deliberately lower-weight than a
                # normal skill and are excluded from the missing-skill penalty.
                total_weight += OPTIONAL_SKILL_WEIGHT
                if skill_name in contributor_skills:
                    weighted_match += OPTIONAL_SKILL_WEIGHT
                continue

            total_weight += confidence
            if skill_name in contributor_skills:
                weighted_match += confidence

        skill_match = weighted_match / total_weight if total_weight else 0.0

        experience_factor = min(1.0, contributor.years_experience / 3)

        interest_factor = 0.5
        if contributor.interests:
            for interest in contributor.interests:
                if interest in issue.title.lower() or interest in issue.body.lower():
                    interest_factor = 0.8
                    break

        score = skill_match * 0.5 + experience_factor * 0.2 + interest_factor * 0.3

        return min(1.0, score)

    def _get_friendliness_score(self, issue: Issue) -> float:
        """
        Get or calculate newcomer friendliness score.
        """
        try:
            friendliness = NewcomerFriendlinessScore.objects.get(issue=issue)
            return friendliness.overall_score / 100
        except NewcomerFriendlinessScore.DoesNotExist:
            score = self._calculate_friendliness(issue)
            NewcomerFriendlinessScore.objects.create(
                issue=issue,
                overall_score=score * 100,
                description_quality=0.7,
                scope_clarity=0.6,
                support_availability=0.5,
                skill_match=0.5,
            )
            return score

    def _calculate_friendliness(self, issue: Issue) -> float:
        """
        Calculate newcomer friendliness score.
        """
        score = 0.5

        if len(issue.body) > 200:
            score += 0.1
        if len(issue.title) > 20:
            score += 0.05

        score += 0.05

        if issue.assignees:
            score += 0.1

        if "docs" in issue.title.lower() or "documentation" in issue.body.lower():
            score += 0.05

        return min(1.0, score)

    def _generate_reasoning(
        self, matched: List[str], missing: List[str], score: float
    ) -> str:
        """
        Generate reasoning for the recommendation.
        """
        parts = []

        if matched:
            parts.append(f"Your skills in {', '.join(matched[:3])} match this issue")

        if missing:
            parts.append(f"You'll learn {', '.join(missing[:3])} while working on this")

        if score > 0.7:
            parts.append("This is a great match for your skill level")
        elif score > 0.5:
            parts.append("This issue is within your skill range")
        else:
            parts.append("This issue is worth trying with some learning")

        return ". ".join(parts)
