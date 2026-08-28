from types import SimpleNamespace
from unittest.mock import Mock

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .services.matcher import SkillMatcher


class Skills_matchingAPITests(APITestCase):
    def test_contributorprofile_list_unauthorized(self):
        url = reverse("contributor-profile-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_skilltag_list_unauthorized(self):
        url = reverse("skill-tag-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_issueskilltag_list_unauthorized(self):
        url = reverse("issue-skill-tag-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_newcomerfriendlinessscore_list_unauthorized(self):
        url = reverse("newcomer-friendliness-score-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recommendation_list_unauthorized(self):
        url = reverse("recommendation-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_skillgapanalysis_list_unauthorized(self):
        url = reverse("skill-gap-analysis-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SkillMatcherLogicTests(TestCase):
    def test_zero_weight_skill_receives_partial_optional_credit(self):
        contributor = SimpleNamespace(
            skill_levels={"python": 1},
            years_experience=0,
            interests=[],
        )
        issue = SimpleNamespace(title="", body="")
        matcher = SkillMatcher.__new__(SkillMatcher)
        matcher.skill_tagger = Mock()
        matcher.skill_tagger.get_required_skills.return_value = [
            {"skill": "python", "confidence": 0.0},
            {"skill": "django", "confidence": 1.0},
        ]

        score = matcher._calculate_match_score(contributor, issue)

        self.assertGreater(score, 0.3)

    def test_recommendations_are_sorted_by_match_score(self):
        recommendations = [
            SimpleNamespace(match_score=40.0),
            SimpleNamespace(match_score=90.0),
            SimpleNamespace(match_score=70.0),
        ]

        recommendations.sort(key=lambda r: r.match_score, reverse=True)

        self.assertEqual(
            [r.match_score for r in recommendations],
            [90.0, 70.0, 40.0],
        )
