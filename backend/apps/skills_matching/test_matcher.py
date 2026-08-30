"""
Regression tests for skill matching optional-skill scoring and recommendation ranking.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from apps.skills_matching.services.matcher import OPTIONAL_SKILL_WEIGHT, SkillMatcher


class SkillMatcherRegressionTests(SimpleTestCase):
    """Regression coverage for issue #2652."""

    def setUp(self):
        self.matcher = SkillMatcher.__new__(SkillMatcher)
        self.matcher.skill_tagger = MagicMock()

    @staticmethod
    def contributor(**overrides):
        values = {
            "skill_levels": {"python": "advanced"},
            "years_experience": 3.0,
            "interests": [],
            "total_recommendations": 0,
            "save": MagicMock(),
        }
        values.update(overrides)
        return SimpleNamespace(**values)

    @staticmethod
    def issue(title="Issue", body="Issue body"):
        return SimpleNamespace(
            title=title,
            body=body,
            assignees=[],
        )

    def test_zero_weight_skill_is_optional_and_does_not_penalize_missing_skill(self):
        contributor = self.contributor()
        issue = self.issue()

        self.matcher.skill_tagger.get_required_skills.return_value = [
            {"skill": "python", "confidence": 1.0},
            {"skill": "docker", "confidence": 0.0},
        ]

        score = self.matcher._calculate_match_score(contributor, issue)

        # The zero-weight Docker preference is not treated as a required
        # missing skill. Python is a complete positive-weight match.
        expected_skill_match = 1.0
        expected_score = expected_skill_match * 0.5 + 1.0 * 0.2 + 0.5 * 0.3

        self.assertAlmostEqual(score, expected_score)
        self.assertEqual(OPTIONAL_SKILL_WEIGHT, 0.1)

    def test_matching_zero_weight_skill_receives_small_optional_credit(self):
        contributor = self.contributor(
            skill_levels={"python": "advanced", "docker": "intermediate"}
        )
        issue = self.issue()

        self.matcher.skill_tagger.get_required_skills.return_value = [
            {"skill": "python", "confidence": 1.0},
            {"skill": "docker", "confidence": 0.0},
        ]

        score = self.matcher._calculate_match_score(contributor, issue)

        # Both positive and optional skills match. The optional skill earns
        # only its 0.1 weight rather than being treated like a full skill.
        expected_skill_match = (1.0 + OPTIONAL_SKILL_WEIGHT) / (
            1.0 + OPTIONAL_SKILL_WEIGHT
        )
        expected_score = expected_skill_match * 0.5 + 1.0 * 0.2 + 0.5 * 0.3

        self.assertAlmostEqual(score, expected_score)

    @patch(
        "apps.skills_matching.services.matcher.Recommendation.objects.create"
    )
    @patch("apps.skills_matching.services.matcher.Issue.objects.filter")
    def test_recommendations_are_sorted_by_combined_score(
        self, mock_issue_filter, mock_create
    ):
        contributor = self.contributor()
        low_match = self.issue(title="Low match")
        high_match = self.issue(title="High match")

        mock_issue_filter.return_value = [low_match, high_match]

        scores = {
            id(low_match): (0.55, 0.50),  # combined = 53
            id(high_match): (0.60, 0.95),  # combined = 74
        }

        self.matcher._calculate_match_score = MagicMock(
            side_effect=lambda _contributor, issue: scores[id(issue)][0]
        )
        self.matcher._get_friendliness_score = MagicMock(
            side_effect=lambda issue: scores[id(issue)][1]
        )
        self.matcher.skill_tagger.get_required_skills.return_value = []

        def create_recommendation(**kwargs):
            return SimpleNamespace(
                issue=kwargs["issue"],
                match_score=kwargs["match_score"],
                friendliness_score=kwargs["friendliness_score"],
                combined_score=kwargs["combined_score"],
            )

        mock_create.side_effect = create_recommendation

        recommendations = self.matcher.match_contributor_to_issues(
            contributor, limit=10
        )

        # This invokes SkillMatcher itself and verifies the production ranking
        # path. Do not replace this with sorting a local test list.
        self.assertEqual(
            [recommendation.issue for recommendation in recommendations],
            [high_match, low_match],
        )
        self.assertEqual(
            [recommendation.combined_score for recommendation in recommendations],
            [74.0, 53.0],
        )
        contributor.save.assert_called_once_with()

    @patch(
        "apps.skills_matching.services.matcher.Recommendation.objects.create"
    )
    @patch("apps.skills_matching.services.matcher.Issue.objects.filter")
    def test_match_score_is_not_used_to_bypass_friendliness_weight(
        self, mock_issue_filter, mock_create
    ):
        contributor = self.contributor()
        strong_skill = self.issue(title="Strong skill, less friendly")
        friendly_issue = self.issue(title="Moderate skill, very friendly")

        mock_issue_filter.return_value = [strong_skill, friendly_issue]

        scores = {
            id(strong_skill): (0.95, 0.20),
            id(friendly_issue): (0.70, 0.95),
        }

        self.matcher._calculate_match_score = MagicMock(
            side_effect=lambda _contributor, issue: scores[id(issue)][0]
        )
        self.matcher._get_friendliness_score = MagicMock(
            side_effect=lambda issue: scores[id(issue)][1]
        )
        self.matcher.skill_tagger.get_required_skills.return_value = []

        mock_create.side_effect = lambda **kwargs: SimpleNamespace(
            issue=kwargs["issue"],
            match_score=kwargs["match_score"],
            combined_score=kwargs["combined_score"],
        )

        recommendations = self.matcher.match_contributor_to_issues(contributor)

        # Strong skill match is 65% combined; the friendlier issue is 80%.
        # Therefore changing the sort key to match_score would be incorrect.
        self.assertEqual(recommendations[0].issue, friendly_issue)
        self.assertEqual(recommendations[1].issue, strong_skill)
        self.assertEqual(recommendations[0].combined_score, 80.0)
        self.assertEqual(recommendations[1].combined_score, 65.0)
