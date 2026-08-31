"""
Tests for Mentorship models and services.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.mentorship.models import (
    MentorProfile,
    MentorshipFeedback,
    MentorshipGoal,
    MentorshipMatch,
    MentorshipMilestone,
    MentorshipRequest,
    MentorshipSession,
)
from apps.mentorship.services import (
    complete_session,
    create_mentorship_request,
    find_mentors,
    get_mentee_analytics,
    get_mentor_analytics,
    get_program_stats,
    respond_to_request,
)


class MentorProfileModelTest(TestCase):
    """Tests for MentorProfile model."""

    def setUp(self):
        self.user = User.objects.create_user(username="mentor1", password="pass123")

    def test_create_profile(self):
        p = MentorProfile.objects.create(
            user=self.user,
            bio="I teach Python",
            expertise_areas=["python", "django"],
            max_mentees=5,
        )
        self.assertFalse(p.is_full)
        self.assertEqual(p.average_rating, 0.0)

    def test_str(self):
        p = MentorProfile.objects.create(
            user=self.user,
            average_rating=4.5,
            total_sessions_mentored=10,
        )
        self.assertIn("mentor1", str(p))
        self.assertIn("4.5", str(p))

    def test_is_full(self):
        p = MentorProfile.objects.create(
            user=self.user, max_mentees=2, current_mentee_count=2
        )
        self.assertTrue(p.is_full)

    def test_acceptance_rate(self):
        MentorProfile.objects.create(user=self.user)
        MentorshipRequest.objects.create(
            mentee=User.objects.create_user(username="u1", password="p"),
            mentor=self.user,
            subject="Help",
            status="accepted",
            expires_at=timezone.now() + timedelta(days=1),
        )
        MentorshipRequest.objects.create(
            mentee=User.objects.create_user(username="u2", password="p"),
            mentor=self.user,
            subject="Help2",
            status="declined",
            expires_at=timezone.now() + timedelta(days=1),
        )
        p = MentorProfile.objects.get(user=self.user)
        self.assertEqual(p.acceptance_rate, 50.0)

    def test_acceptance_rate_zero_requests(self):
        MentorProfile.objects.create(user=self.user)
        p = MentorProfile.objects.get(user=self.user)
        self.assertEqual(p.acceptance_rate, 0.0)


class MentorshipRequestModelTest(TestCase):
    """Tests for MentorshipRequest model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")

    def test_create_request(self):
        r = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Learn Django",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertEqual(r.status, "pending")

    def test_str(self):
        r = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Help with git",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertIn("mentee", str(r))
        self.assertIn("mentor", str(r))

    def test_is_expired(self):
        r = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Expired",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertTrue(r.is_expired)

    def test_not_expired(self):
        r = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Valid",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertFalse(r.is_expired)


class MentorshipMatchModelTest(TestCase):
    """Tests for MentorshipMatch model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")

    def test_create_match(self):
        m = MentorshipMatch.objects.create(
            mentor=self.mentor,
            mentee=self.mentee,
            skill_focus="python",
        )
        self.assertEqual(m.status, "active")
        self.assertEqual(m.total_sessions, 0)

    def test_str(self):
        m = MentorshipMatch.objects.create(
            mentor=self.mentor,
            mentee=self.mentee,
            skill_focus="git",
        )
        self.assertIn("mentor", str(m))
        self.assertIn("git", str(m))


class MentorshipSessionModelTest(TestCase):
    """Tests for MentorshipSession model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_create_session(self):
        s = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Intro Session",
            scheduled_at=timezone.now(),
        )
        self.assertEqual(s.status, "scheduled")

    def test_start_session(self):
        s = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Session",
            scheduled_at=timezone.now(),
        )
        s.start_session()
        self.assertEqual(s.status, "in_progress")
        self.assertIsNotNone(s.started_at)

    def test_complete_session(self):
        s = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Session",
            scheduled_at=timezone.now(),
            started_at=timezone.now(),
        )
        s.complete_session()
        self.assertEqual(s.status, "completed")
        self.assertIsNotNone(s.ended_at)

    def test_str(self):
        s = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Git Basics",
            scheduled_at=timezone.now(),
        )
        self.assertIn("Git Basics", str(s))


class MentorshipGoalModelTest(TestCase):
    """Tests for MentorshipGoal model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_create_goal(self):
        g = MentorshipGoal.objects.create(
            match=self.match,
            created_by=self.mentee,
            title="Learn Django ORM",
            progress_pct=40,
        )
        self.assertEqual(g.progress_pct, 40)
        self.assertEqual(g.status, "active")


class MentorshipFeedbackModelTest(TestCase):
    """Tests for MentorshipFeedback model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_create_feedback(self):
        f = MentorshipFeedback.objects.create(
            match=self.match,
            from_user=self.mentee,
            to_user=self.mentor,
            feedback_type="mentee_on_mentor",
            overall_rating=5,
            communication_rating=4,
            helpfulness_rating=5,
            comment="Great mentor!",
        )
        self.assertEqual(f.overall_rating, 5)
        self.assertFalse(f.is_anonymous)


class MentorshipMilestoneModelTest(TestCase):
    """Tests for MentorshipMilestone model."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )

    def test_create_milestone(self):
        m = MentorshipMilestone.objects.create(
            match=self.match,
            user=self.mentee,
            title="First PR Merged!",
            xp_awarded=75,
        )
        self.assertEqual(m.xp_awarded, 75)


# ---------------------------------------------------------------------------
#  Service Tests
# ---------------------------------------------------------------------------


class FindMentorsTest(TestCase):
    """Tests for find_mentors service."""

    def setUp(self):
        self.seeker = User.objects.create_user(username="seeker", password="p")
        self.mentor_user = User.objects.create_user(username="mentor1", password="p")
        self.profile = MentorProfile.objects.create(
            user=self.mentor_user,
            expertise_areas=["python", "django"],
            availability="available",
            max_mentees=3,
            average_rating=4.5,
            total_sessions_mentored=15,
        )

    def test_find_with_skill(self):
        results = find_mentors(self.seeker, skill_slug="python")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["user"].username, "mentor1")

    def test_find_no_match(self):
        results = find_mentors(self.seeker, skill_slug="rust")
        self.assertEqual(len(results), 0)

    def test_find_excludes_self(self):
        MentorProfile.objects.create(
            user=self.seeker,
            expertise_areas=["python"],
            availability="available",
        )
        results = find_mentors(self.seeker, skill_slug="python")
        usernames = [r["user"].username for r in results]
        self.assertNotIn("seeker", usernames)

    def test_find_with_min_rating(self):
        MentorProfile.objects.create(
            user=User.objects.create_user(username="low_rated", password="p"),
            expertise_areas=["python"],
            availability="available",
            average_rating=2.0,
        )
        results = find_mentors(self.seeker, skill_slug="python", min_rating=4.0)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["user"].username, "mentor1")


class CreateMentorshipRequestTest(TestCase):
    """Tests for create_mentorship_request service."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        MentorProfile.objects.create(user=self.mentor, max_mentees=3)

    def test_create_request(self):
        result = create_mentorship_request(self.mentee, self.mentor.id, "Learn Django")
        self.assertIn("request_id", result)

    def test_self_request(self):
        result = create_mentorship_request(self.mentor, self.mentor.id, "Self")
        self.assertIn("error", result)

    def test_mentor_not_found(self):
        result = create_mentorship_request(self.mentee, 9999, "X")
        self.assertIn("error", result)

    def test_full_mentor(self):
        MentorProfile.objects.filter(user=self.mentor).update(
            current_mentee_count=3, max_mentees=3
        )
        result = create_mentorship_request(self.mentee, self.mentor.id, "X")
        self.assertIn("error", result)


class RespondToRequestTest(TestCase):
    """Tests for respond_to_request service."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.profile = MentorProfile.objects.create(user=self.mentor, max_mentees=3)
        self.request = MentorshipRequest.objects.create(
            mentee=self.mentee,
            mentor=self.mentor,
            subject="Learn",
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )

    def test_accept(self):
        result = respond_to_request(self.mentor, self.request.id, accept=True)
        self.assertTrue(result.get("success"))
        self.assertIn("match_id", result)
        self.assertTrue(
            MentorshipMatch.objects.filter(
                mentor=self.mentor, mentee=self.mentee
            ).exists()
        )

    def test_decline(self):
        result = respond_to_request(self.mentor, self.request.id, accept=False)
        self.assertTrue(result.get("success"))
        self.assertFalse(
            MentorshipMatch.objects.filter(
                mentor=self.mentor, mentee=self.mentee
            ).exists()
        )

    def test_already_processed(self):
        self.request.status = "accepted"
        self.request.save()
        result = respond_to_request(self.mentor, self.request.id, accept=True)
        self.assertIn("error", result)

    def test_expired_request(self):
        self.request.expires_at = timezone.now() - timedelta(hours=1)
        self.request.save()
        result = respond_to_request(self.mentor, self.request.id, accept=True)
        self.assertIn("error", result)


class CompleteSessionTest(TestCase):
    """Tests for complete_session service."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        self.mentee = User.objects.create_user(username="mentee", password="p")
        self.match = MentorshipMatch.objects.create(
            mentor=self.mentor, mentee=self.mentee
        )
        self.session = MentorshipSession.objects.create(
            match=self.match,
            mentor=self.mentor,
            mentee=self.mentee,
            title="Session",
            scheduled_at=timezone.now(),
            started_at=timezone.now(),
            status="in_progress",
        )
        MentorProfile.objects.create(user=self.mentor)

    def test_complete_with_ratings(self):
        result = complete_session(
            self.session.id,
            self.mentor,
            mentor_rating=5,
            topics_covered=["git", "python"],
            action_items=["Practice git rebase"],
        )
        self.assertTrue(result.get("success"))
        self.assertGreater(result["xp_awarded_mentor"], 0)
        self.assertGreater(result["xp_awarded_mentee"], 0)

    def test_complete_updates_match(self):
        complete_session(self.session.id, self.mentor)
        self.match.refresh_from_db()
        self.assertEqual(self.match.total_sessions, 1)

    def test_session_not_found(self):
        result = complete_session(9999, self.mentor)
        self.assertIn("error", result)


class GetMentorAnalyticsTest(TestCase):
    """Tests for get_mentor_analytics service."""

    def setUp(self):
        self.mentor = User.objects.create_user(username="mentor", password="p")
        MentorProfile.objects.create(
            user=self.mentor, average_rating=4.2, rating_count=5
        )

    def test_empty_analytics(self):
        analytics = get_mentor_analytics(self.mentor)
        self.assertEqual(analytics["total_sessions"], 0)

    def test_with_sessions(self):
        mentee = User.objects.create_user(username="mentee", password="p")
        match = MentorshipMatch.objects.create(mentor=self.mentor, mentee=mentee)
        MentorshipSession.objects.create(
            match=match,
            mentor=self.mentor,
            mentee=mentee,
            title="S",
            status="completed",
            duration_minutes=30,
            scheduled_at=timezone.now(),
        )
        analytics = get_mentor_analytics(self.mentor)
        self.assertEqual(analytics["total_sessions"], 1)


class GetMenteeAnalyticsTest(TestCase):
    """Tests for get_mentee_analytics service."""

    def setUp(self):
        self.mentee = User.objects.create_user(username="mentee", password="p")

    def test_empty_analytics(self):
        analytics = get_mentee_analytics(self.mentee)
        self.assertEqual(analytics["total_sessions"], 0)


class GetProgramStatsTest(TestCase):
    """Tests for get_program_stats."""

    def test_empty_stats(self):
        stats = get_program_stats()
        self.assertEqual(stats["total_mentors"], 0)
        self.assertEqual(stats["total_sessions"], 0)

    def test_with_data(self):
        mentor = User.objects.create_user(username="mentor", password="p")
        MentorProfile.objects.create(user=mentor)
        stats = get_program_stats()
        self.assertEqual(stats["total_mentors"], 1)
