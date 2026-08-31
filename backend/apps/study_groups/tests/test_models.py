"""
Tests for Study Groups models.
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
    GroupMessage,
    GroupResource,
    StudyGroup,
)


class StudyGroupModelTest(TestCase):
    """Tests for StudyGroup model."""

    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pass123")

    def test_create_group(self):
        group = StudyGroup.objects.create(
            name="Open Source Learners",
            slug="open-source-learners",
            owner=self.user,
        )
        self.assertEqual(group.member_count, 1)
        self.assertEqual(group.total_xp, 0)
        self.assertFalse(group.is_archived)

    def test_str(self):
        group = StudyGroup.objects.create(
            name="Test Group",
            slug="test-group",
            owner=self.user,
            member_count=5,
        )
        self.assertIn("Test Group", str(group))
        self.assertIn("5 members", str(group))

    def test_is_full(self):
        group = StudyGroup.objects.create(
            name="Tiny",
            slug="tiny",
            owner=self.user,
            max_members=2,
            member_count=2,
        )
        self.assertTrue(group.is_full)

    def test_not_full(self):
        group = StudyGroup.objects.create(
            name="Big",
            slug="big",
            owner=self.user,
            max_members=100,
            member_count=5,
        )
        self.assertFalse(group.is_full)

    def test_is_member(self):
        group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        GroupMembership.objects.create(user=self.user, group=group, role="owner")
        self.assertTrue(group.is_member(self.user))

    def test_not_member(self):
        user2 = User.objects.create_user(username="other", password="pass123")
        group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        self.assertFalse(group.is_member(user2))

    def test_get_member_role(self):
        group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        GroupMembership.objects.create(user=self.user, group=group, role="owner")
        self.assertEqual(group.get_member_role(self.user), "owner")

    def test_get_member_role_none(self):
        group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        self.assertIsNone(group.get_member_role(self.user))


class GroupMembershipModelTest(TestCase):
    """Tests for GroupMembership model."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass123")
        self.group = StudyGroup.objects.create(
            name="Test", slug="test", owner=self.user
        )

    def test_create_membership(self):
        m = GroupMembership.objects.create(
            user=self.user, group=self.group, role="member"
        )
        self.assertEqual(m.role, "member")
        self.assertEqual(m.status, "active")

    def test_str(self):
        m = GroupMembership.objects.create(user=self.user, group=self.group)
        self.assertIn("testuser", str(m))
        self.assertIn("Test", str(m))

    def test_is_officer_owner(self):
        m = GroupMembership.objects.create(
            user=self.user, group=self.group, role="owner"
        )
        self.assertTrue(m.is_officer)

    def test_is_officer_admin(self):
        m = GroupMembership.objects.create(
            user=self.user, group=self.group, role="admin"
        )
        self.assertTrue(m.is_officer)

    def test_not_officer(self):
        m = GroupMembership.objects.create(
            user=self.user, group=self.group, role="member"
        )
        self.assertFalse(m.is_officer)


class GroupInviteModelTest(TestCase):
    """Tests for GroupInvite model."""

    def setUp(self):
        self.user = User.objects.create_user(username="inviter", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_invite(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            email="test@example.com",
            token="abc123",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertEqual(invite.status, "pending")

    def test_str(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            email="test@example.com",
            token="xyz",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.assertIn("test@example.com", str(invite))

    def test_is_expired(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            token="expired",
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertTrue(invite.is_expired)

    def test_not_expired(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            token="valid",
            expires_at=timezone.now() + timedelta(days=1),
        )
        self.assertFalse(invite.is_expired)


class GroupResourceModelTest(TestCase):
    """Tests for GroupResource model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_resource(self):
        r = GroupResource.objects.create(
            group=self.group,
            shared_by=self.user,
            resource_type="link",
            title="Django Docs",
            url="https://docs.djangoproject.com",
        )
        self.assertEqual(r.upvotes, 0)

    def test_str(self):
        r = GroupResource.objects.create(
            group=self.group,
            shared_by=self.user,
            resource_type="deck",
            title="My Deck",
        )
        self.assertIn("deck", str(r))
        self.assertIn("My Deck", str(r))


class GroupActivityModelTest(TestCase):
    """Tests for GroupActivity model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_activity(self):
        a = GroupActivity.objects.create(
            group=self.group,
            user=self.user,
            activity_type="lesson",
            title="Completed Intro to Git",
            xp_value=25,
        )
        self.assertEqual(a.activity_type, "lesson")

    def test_str(self):
        a = GroupActivity.objects.create(
            group=self.group,
            user=self.user,
            activity_type="join",
            title="Joined!",
        )
        self.assertIn("user1", str(a))
        self.assertIn("join", str(a))


class GroupChallengeModelTest(TestCase):
    """Tests for GroupChallenge model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_challenge(self):
        c = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="10 Lessons Sprint",
            description="Complete 10 lessons in a week",
            target_value=10,
            target_type="lessons",
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=7),
        )
        self.assertEqual(c.status, "upcoming")

    def test_is_active(self):
        c = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="Active",
            description="",
            status="active",
            start_date=timezone.now() - timedelta(days=1),
            end_date=timezone.now() + timedelta(days=6),
        )
        self.assertTrue(c.is_active)

    def test_not_active(self):
        c = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="Future",
            description="",
            start_date=timezone.now() + timedelta(days=10),
            end_date=timezone.now() + timedelta(days=17),
        )
        self.assertFalse(c.is_active)


class GroupChallengeParticipantTest(TestCase):
    """Tests for GroupChallengeParticipant model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)
        self.challenge = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="Test",
            description="",
            target_value=10,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=7),
        )

    def test_create_participant(self):
        p = GroupChallengeParticipant.objects.create(
            challenge=self.challenge,
            user=self.user,
            current_value=5,
        )
        self.assertEqual(p.progress_pct, 50)

    def test_progress_zero_target(self):
        p = GroupChallengeParticipant.objects.create(
            challenge=self.challenge,
            user=self.user,
        )
        self.challenge.target_value = 0
        self.assertEqual(p.progress_pct, 0)


class GroupGoalModelTest(TestCase):
    """Tests for GroupGoal model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_goal(self):
        g = GroupGoal.objects.create(
            group=self.group,
            goal_type="total_xp",
            title="1000 Group XP",
            target_value=1000,
            current_value=350,
        )
        self.assertEqual(g.progress_pct, 35)

    def test_progress_complete(self):
        g = GroupGoal.objects.create(
            group=self.group,
            goal_type="lesson_count",
            title="50 Lessons",
            target_value=50,
            current_value=50,
        )
        self.assertEqual(g.progress_pct, 100)


class GroupMessageModelTest(TestCase):
    """Tests for GroupMessage model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="pass123")
        self.group = StudyGroup.objects.create(name="G", slug="g", owner=self.user)

    def test_create_message(self):
        m = GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Hello everyone!",
        )
        self.assertFalse(m.is_pinned)

    def test_str(self):
        m = GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Hi",
        )
        self.assertIn("user1", str(m))

    def test_reply(self):
        parent = GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Question",
        )
        reply = GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Answer",
            parent=parent,
        )
        self.assertEqual(reply.parent, parent)
        self.assertIn(reply, parent.replies.all())
