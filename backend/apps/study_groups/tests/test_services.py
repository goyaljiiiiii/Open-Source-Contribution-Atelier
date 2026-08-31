"""
Tests for Study Groups services.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.study_groups.models import (
    GroupActivity,
    GroupChallenge,
    GroupChallengeParticipant,
    GroupGoal,
    GroupInvite,
    GroupMembership,
    GroupResource,
    StudyGroup,
)
from apps.study_groups.services import (
    accept_invite,
    create_invite,
    discover_groups,
    get_group_leaderboard,
    get_group_stats,
    get_platform_group_stats,
    record_group_activity,
)


class RecordGroupActivityTest(TestCase):
    """Tests for record_group_activity service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(
            name="Test", slug="test", owner=self.user
        )
        GroupMembership.objects.create(user=self.user, group=self.group)

    def test_record_lesson_activity(self):
        a = record_group_activity(
            self.group,
            self.user,
            "lesson",
            "Completed Lesson 1",
        )
        self.assertEqual(a.activity_type, "lesson")
        self.user.study_group_memberships.first().refresh_from_db()
        m = GroupMembership.objects.get(user=self.user, group=self.group)
        self.assertEqual(m.lessons_completed, 1)

    def test_record_xp_activity(self):
        a = record_group_activity(
            self.group,
            self.user,
            "xp",
            "Earned XP",
            xp_value=50,
        )
        self.group.refresh_from_db()
        self.assertEqual(self.group.total_xp, 50)

    def test_record_quiz_activity(self):
        record_group_activity(self.group, self.user, "quiz", "Quiz passed")
        m = GroupMembership.objects.get(user=self.user, group=self.group)
        self.assertEqual(m.quizzes_passed, 1)

    def test_record_join_activity(self):
        a = record_group_activity(
            self.group,
            self.user,
            "join",
            "Joined!",
        )
        self.assertEqual(a.activity_type, "join")

    def test_accumulates_xp(self):
        record_group_activity(self.group, self.user, "xp", "First", xp_value=30)
        record_group_activity(self.group, self.user, "xp", "Second", xp_value=20)
        self.group.refresh_from_db()
        self.assertEqual(self.group.total_xp, 50)


class CreateInviteTest(TestCase):
    """Tests for create_invite service."""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.owner)

    def test_create_email_invite(self):
        result = create_invite(self.group, self.owner, email="test@example.com")
        self.assertIn("token", result)
        self.assertIn("expires_at", result)

    def test_create_user_invite(self):
        target = User.objects.create_user(username="target", password="pass123")
        result = create_invite(self.group, self.owner, invited_user=target)
        self.assertIn("token", result)

    def test_invite_record_created(self):
        create_invite(self.group, self.owner, email="a@b.com")
        self.assertEqual(GroupInvite.objects.count(), 1)


class AcceptInviteTest(TestCase):
    """Tests for accept_invite service."""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass123")
        self.new_user = User.objects.create_user(username="newbie", password="pass123")
        self.group = StudyGroup.objects.create(
            name="G", slug="g", owner=self.owner, max_members=10
        )
        GroupMembership.objects.create(user=self.owner, group=self.group, role="owner")

    def test_accept_valid_invite(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.owner,
            invited_user=self.new_user,
            token="validtoken",
            expires_at=timezone.now() + timedelta(days=7),
        )
        result = accept_invite("validtoken", self.new_user)
        self.assertTrue(result.get("success"))
        self.assertTrue(
            GroupMembership.objects.filter(
                group=self.group, user=self.new_user
            ).exists()
        )

    def test_accept_invalid_token(self):
        result = accept_invite("badtoken", self.new_user)
        self.assertIn("error", result)

    def test_accept_expired_invite(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.owner,
            invited_user=self.new_user,
            token="expiredtoken",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        result = accept_invite("expiredtoken", self.new_user)
        self.assertIn("error", result)

    def test_accept_already_accepted(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.owner,
            invited_user=self.new_user,
            token="alreadyaccepted",
            expires_at=timezone.now() + timedelta(days=7),
            status="accepted",
        )
        result = accept_invite("alreadyaccepted", self.new_user)
        self.assertIn("error", result)

    def test_accept_full_group(self):
        self.group.max_members = 1
        self.group.save()
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.owner,
            invited_user=self.new_user,
            token="fulltoken",
            expires_at=timezone.now() + timedelta(days=7),
        )
        result = accept_invite("fulltoken", self.new_user)
        self.assertIn("error", result)


class GetGroupStatsTest(TestCase):
    """Tests for get_group_stats service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        GroupMembership.objects.create(user=self.user, group=self.group)

    def test_empty_group_stats(self):
        stats = get_group_stats(self.group)
        self.assertEqual(stats["member_count"], 1)
        self.assertEqual(stats["total_xp"], 0)

    def test_with_activity(self):
        record_group_activity(
            self.group,
            self.user,
            "xp",
            "XP",
            xp_value=100,
        )
        stats = get_group_stats(self.group)
        self.assertEqual(stats["total_xp"], 100)


class GetGroupLeaderboardTest(TestCase):
    """Tests for get_group_leaderboard service."""

    def setUp(self):
        self.user1 = User.objects.create_user(username="user1", password="pass123")
        self.user2 = User.objects.create_user(username="user2", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user1)
        GroupMembership.objects.create(
            user=self.user1,
            group=self.group,
            total_xp_contributed=200,
        )
        GroupMembership.objects.create(
            user=self.user2,
            group=self.group,
            total_xp_contributed=100,
        )

    def test_all_time_leaderboard(self):
        lb = get_group_leaderboard(self.group, period="all_time")
        self.assertEqual(len(lb), 2)
        self.assertEqual(lb[0]["xp"], 200)

    def test_weekly_leaderboard(self):
        record_group_activity(
            self.group,
            self.user2,
            "xp",
            "XP",
            xp_value=50,
        )
        lb = get_group_leaderboard(self.group, period="weekly")
        self.assertEqual(len(lb), 2)


class DiscoverGroupsTest(TestCase):
    """Tests for discover_groups service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")

    def test_discover_public(self):
        StudyGroup.objects.create(
            name="Public",
            slug="public",
            owner=self.user,
            visibility="public",
        )
        groups = discover_groups(self.user)
        self.assertEqual(len(groups), 1)

    def test_excludes_private(self):
        StudyGroup.objects.create(
            name="Private",
            slug="private",
            owner=self.user,
            visibility="private",
        )
        groups = discover_groups(self.user)
        self.assertEqual(len(groups), 0)

    def test_excludes_joined(self):
        g = StudyGroup.objects.create(
            name="Joined",
            slug="joined",
            owner=self.user,
            visibility="public",
        )
        GroupMembership.objects.create(user=self.user, group=g)
        groups = discover_groups(self.user)
        self.assertEqual(len(groups), 0)

    def test_category_filter(self):
        StudyGroup.objects.create(
            name="Python",
            slug="python",
            owner=self.user,
            visibility="public",
            category="python",
        )
        StudyGroup.objects.create(
            name="JS",
            slug="js",
            owner=self.user,
            visibility="public",
            category="javascript",
        )
        groups = discover_groups(self.user, category="python")
        self.assertEqual(len(groups), 1)

    def test_search(self):
        StudyGroup.objects.create(
            name="Django Experts",
            slug="django-experts",
            owner=self.user,
            visibility="public",
            description="Learn Django together",
        )
        groups = discover_groups(self.user, search="Django")
        self.assertEqual(len(groups), 1)


class GetPlatformGroupStatsTest(TestCase):
    """Tests for get_platform_group_stats."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")

    def test_empty_stats(self):
        stats = get_platform_group_stats()
        self.assertEqual(stats["total_groups"], 0)

    def test_with_groups(self):
        StudyGroup.objects.create(name="G1", slug="g1", owner=self.user)
        StudyGroup.objects.create(name="G2", slug="g2", owner=self.user)
        stats = get_platform_group_stats()
        self.assertEqual(stats["total_groups"], 2)
        self.assertEqual(stats["total_members"], 2)
