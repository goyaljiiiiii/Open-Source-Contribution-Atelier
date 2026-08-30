"""
Tests for Mentorship API views.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.mentorship.models import (
    MentorProfile,
    MentorshipMatch,
    MentorshipRequest,
    MentorshipSession,
)


class BaseMentorshipTest(TestCase):
    """Shared setup."""

    def setUp(self):
        self.mentor = User.objects.create_user(
            username="mentor", password="pass123"
        )
        self.mentee = User.objects.create_user(
            username="mentee", password="pass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.mentor)
        self.profile = MentorProfile.objects.create(
            user=self.mentor,
            expertise_areas=["python", "django"],
            availability="available",
            max_mentees=5,
        )


class MentorProfileListCreateViewTest(BaseMentorshipTest):
    """Tests for MentorProfileListCreateView."""

    def test_list_mentors(self):
        url = reverse("mentorship:mentor-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated(self):
        self.client.force_authenticate(user=None)
        url = reverse("mentorship:mentor-list")
        response = self.client.get(url)
        self.assertEqual(
            response.status_code, status.HTTP_401_UNAUTHORIZED
        )


class MyMentorProfileViewTest(BaseMentorshipTest):
    """Tests for MyMentorProfileView."""

    def test_get_existing_profile(self):
        url = reverse("mentorship:my-mentor-profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "mentor")

    def test_create_new_profile(self):
        self.client.force_authenticate(user=self.mentee)
        url = reverse("mentorship:my-mentor-profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class FindMentorsViewTest(BaseMentorshipTest):
    """Tests for FindMentorsView."""

    def test_find_python_mentors(self):
        url = reverse("mentorship:find-mentors")
        self.client.force_authenticate(user=self.mentee)
        response = self.client.get(url, {"skill": "python"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["count"], 0)

    def test_find_no_match(self):
        url = reverse("mentorship:find-mentors")
        self.client.force_authenticate(user=self.mentee)
        response = self.client.get(url, {"skill": "rust"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_excludes_self(self):
        url = reverse("mentorship:find-mentors")
        response = self.client.get(url, {"skill": "python"})
        usernames = [m["username"] for m in response.data["mentors"]]
        self.assertNotIn("mentor", usernames)


class MentorshipRequestListCreateViewTest(BaseMentorshipTest):
    """Tests for MentorshipRequestListCreateView."""

    def test_list_requests(self):
        url = reverse("mentorship:request-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_request(self):
        url = reverse("mentorship:request-list")
        self.client.force_authenticate(user=self.mentee)
        data = {
            "mentor": self.mentor.id,
            "subject": "Learn Django",
            "message": "I want to learn Django!",
            "skill_wanted": "django",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class IncomingRequestListViewTest(BaseMentorshipTest):
    """Tests for IncomingRequestListView."""

    def test_list_incoming(self):
        MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Help",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )
        url = reverse("mentorship:incoming-requests")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class RespondToRequestViewTest(BaseMentorshipTest):
    """Tests for RespondToRequestView."""

    def setUp(self):
        super().setUp()
        self.request_obj = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Learn Python",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )

    def test_accept_request(self):
        url = reverse(
            "mentorship:respond-to-request",
            args=[self.request_obj.id],
        )
        response = self.client.post(
            url,
            {"accept": True, "response_message": "Welcome!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

    def test_decline_request(self):
        url = reverse(
            "mentorship:respond-to-request",
            args=[self.request_obj.id],
        )
        response = self.client.post(
            url, {"accept": False}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class MentorshipMatchListViewTest(BaseMentorshipTest):
    """Tests for MentorshipMatchListView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_list_matches(self):
        url = reverse("mentorship:match-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class MatchDetailViewTest(BaseMentorshipTest):
    """Tests for MatchDetailView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_retrieve_match(self):
        url = reverse(
            "mentorship:match-detail", args=[self.match.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_notes(self):
        url = reverse(
            "mentorship:match-detail", args=[self.match.id]
        )
        response = self.client.patch(
            url, {"notes": "Updated notes"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class SessionListCreateViewTest(BaseMentorshipTest):
    """Tests for SessionListCreateView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_list_sessions(self):
        url = reverse("mentorship:session-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_session(self):
        url = reverse("mentorship:session-list")
        data = {
            "match": self.match.id,
            "mentee": self.mentee.id,
            "title": "Git Basics",
            "scheduled_at": (
                timezone.now() + timedelta(days=1)
            ).isoformat(),
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class SessionStartCompleteViewTest(BaseMentorshipTest):
    """Tests for SessionStart and SessionComplete views."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )
        self.session = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Session",
            scheduled_at=timezone.now(),
        )

    def test_start_session(self):
        url = reverse(
            "mentorship:session-start", args=[self.session.id]
        )
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "in_progress")

    def test_complete_session(self):
        self.session.start_session()
        url = reverse(
            "mentorship:session-complete", args=[self.session.id]
        )
        data = {
            "mentor_rating": 5,
            "topics_covered": ["git", "python"],
            "action_items": ["Practice rebase"],
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])


class MatchGoalListCreateViewTest(BaseMentorshipTest):
    """Tests for MatchGoalListCreateView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_list_goals(self):
        url = reverse(
            "mentorship:match-goals", args=[self.match.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_goal(self):
        url = reverse(
            "mentorship:match-goals", args=[self.match.id]
        )
        data = {
            "title": "Master Django ORM",
            "description": "Learn all ORM operations",
            "target_date": (
                timezone.now() + timedelta(days=30)
            ).date().isoformat(),
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class FeedbackListCreateViewTest(BaseMentorshipTest):
    """Tests for FeedbackListCreateView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_list_feedback(self):
        url = reverse(
            "mentorship:match-feedback", args=[self.match.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_submit_feedback(self):
        url = reverse(
            "mentorship:match-feedback", args=[self.match.id]
        )
        data = {
            "overall_rating": 5,
            "communication_rating": 4,
            "helpfulness_rating": 5,
            "comment": "Excellent session!",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class MentorAnalyticsViewTest(BaseMentorshipTest):
    """Tests for MentorAnalyticsView."""

    def test_get_analytics(self):
        url = reverse("mentorship:mentor-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_sessions", response.data)


class MenteeAnalyticsViewTest(BaseMentorshipTest):
    """Tests for MenteeAnalyticsView."""

    def test_get_analytics(self):
        self.client.force_authenticate(user=self.mentee)
        url = reverse("mentorship:mentee-analytics")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ProgramStatsViewTest(BaseMentorshipTest):
    """Tests for ProgramStatsView."""

    def test_get_stats(self):
        url = reverse("mentorship:program-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_mentors", response.data)


class MatchRecommendationsViewTest(BaseMentorshipTest):
    """Tests for MatchRecommendationsView."""

    def setUp(self):
        super().setUp()
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor,
            mentee=self.mentee,
            skill_focus="python",
        )

    def test_get_recommendations(self):
        url = reverse(
            "mentorship:match-recommendations",
            args=[self.match.id],
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("recommendations", response.data)
        self.assertGreater(len(response.data["recommendations"]), 0)

    def test_nonexistent_match(self):
        url = reverse(
            "mentorship:match-recommendations", args=[9999]
        )
        response = self.client.get(url)
        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )
