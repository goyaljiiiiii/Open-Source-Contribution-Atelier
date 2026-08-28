"""
Tests for Study Groups API views.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.study_groups.models import (
    GroupActivity,
    GroupChallenge,
    GroupChallengeParticipant,
    GroupInvite,
    GroupMembership,
    GroupMessage,
    GroupResource,
    StudyGroup,
)


class BaseStudyGroupTest(TestCase):
    """Shared test setup."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.group = StudyGroup.objects.create(
            name="Test Group",
            slug="test-group",
            owner=self.user,
            visibility="public",
        )
        GroupMembership.objects.create(
            user=self.user, group=self.group, role="owner"
        )


class StudyGroupListCreateViewTest(BaseStudyGroupTest):
    """Tests for StudyGroupListCreateView."""

    def test_list_groups(self):
        url = reverse("study_groups:group-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_group(self):
        url = reverse("study_groups:group-list")
        data = {
            "name": "New Group",
            "slug": "new-group",
            "description": "A new study group",
            "category": "python",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_group_auto_owner(self):
        url = reverse("study_groups:group-list")
        data = {"name": "My Group", "slug": "my-group"}
        self.client.post(url, data, format="json")
        new_group = StudyGroup.objects.get(slug="my-group")
        self.assertTrue(new_group.is_member(self.user))
        self.assertEqual(new_group.get_member_role(self.user), "owner")


class StudyGroupDetailViewTest(BaseStudyGroupTest):
    """Tests for StudyGroupDetailView."""

    def test_retrieve(self):
        url = reverse(
            "study_groups:group-detail", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_member"])

    def test_update_as_owner(self):
        url = reverse(
            "study_groups:group-detail", args=[self.group.id]
        )
        response = self.client.patch(
            url, {"description": "Updated"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_as_non_owner(self):
        self.client.force_authenticate(user=self.other_user)
        GroupMembership.objects.create(
            user=self.other_user, group=self.group, role="member"
        )
        url = reverse(
            "study_groups:group-detail", args=[self.group.id]
        )
        response = self.client.patch(
            url, {"description": "Hacked"}, format="json"
        )
        self.assertEqual(
            response.status_code, status.HTTP_403_FORBIDDEN
        )


class JoinGroupViewTest(BaseStudyGroupTest):
    """Tests for JoinGroupView."""

    def setUp(self):
        super().setUp()
        self.public_group = StudyGroup.objects.create(
            name="Public",
            slug="public",
            owner=self.other_user,
            visibility="public",
        )

    def test_join_public_group(self):
        url = reverse(
            "study_groups:join-group", args=[self.public_group.id]
        )
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_join_already_member(self):
        url = reverse(
            "study_groups:join-group", args=[self.group.id]
        )
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_join_private_group(self):
        private = StudyGroup.objects.create(
            name="Private",
            slug="private",
            owner=self.other_user,
            visibility="private",
        )
        url = reverse(
            "study_groups:join-group", args=[private.id]
        )
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_403_FORBIDDEN
        )

    def test_join_full_group(self):
        full = StudyGroup.objects.create(
            name="Full",
            slug="full",
            owner=self.other_user,
            max_members=2,
            member_count=2,
        )
        url = reverse(
            "study_groups:join-group", args=[full.id]
        )
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST
        )


class LeaveGroupViewTest(BaseStudyGroupTest):
    """Tests for LeaveGroupView."""

    def test_leave_group(self):
        url = reverse(
            "study_groups:leave-group", args=[self.group.id]
        )
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_owner_cannot_leave(self):
        url = reverse(
            "study_groups:leave-group", args=[self.group.id]
        )
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_leave_not_member(self):
        self.client.force_authenticate(user=self.other_user)
        url = reverse(
            "study_groups:leave-group", args=[self.group.id]
        )
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )


class GroupMemberListViewTest(BaseStudyGroupTest):
    """Tests for GroupMemberListView."""

    def test_list_members(self):
        url = reverse(
            "study_groups:member-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class GroupResourceListCreateViewTest(BaseStudyGroupTest):
    """Tests for GroupResourceListCreateView."""

    def test_list_resources(self):
        url = reverse(
            "study_groups:resource-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_resource(self):
        url = reverse(
            "study_groups:resource-list", args=[self.group.id]
        )
        data = {
            "resource_type": "link",
            "title": "Django Docs",
            "url": "https://docs.djangoproject.com",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class ResourceUpvoteViewTest(BaseStudyGroupTest):
    """Tests for ResourceUpvoteView."""

    def test_upvote(self):
        r = GroupResource.objects.create(
            group=self.group,
            shared_by=self.user,
            resource_type="link",
            title="Link",
        )
        url = reverse(
            "study_groups:resource-upvote",
            args=[self.group.id, r.id],
        )
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        r.refresh_from_db()
        self.assertEqual(r.upvotes, 1)


class GroupActivityListViewTest(BaseStudyGroupTest):
    """Tests for GroupActivityListView."""

    def test_list_activities(self):
        GroupActivity.objects.create(
            group=self.group,
            user=self.user,
            activity_type="join",
            title="Joined",
        )
        url = reverse(
            "study_groups:activity-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)


class GroupInviteCreateViewTest(BaseStudyGroupTest):
    """Tests for GroupInviteCreateView."""

    def test_create_invite_as_owner(self):
        url = reverse(
            "study_groups:invite-create", args=[self.group.id]
        )
        data = {"email": "new@example.com"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_invite_as_member_forbidden(self):
        self.client.force_authenticate(user=self.other_user)
        GroupMembership.objects.create(
            user=self.other_user, group=self.group, role="member"
        )
        url = reverse(
            "study_groups:invite-create", args=[self.group.id]
        )
        response = self.client.post(
            url, {"email": "a@b.com"}, format="json"
        )
        self.assertEqual(
            response.status_code, status.HTTP_403_FORBIDDEN
        )


class AcceptInviteViewTest(BaseStudyGroupTest):
    """Tests for AcceptInviteView."""

    def test_accept_invite(self):
        invite = GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            invited_user=self.other_user,
            token="validtoken123",
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client.force_authenticate(user=self.other_user)
        url = reverse("study_groups:invite-accept")
        response = self.client.post(
            url, {"token": "validtoken123"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])


class GroupInviteListViewTest(BaseStudyGroupTest):
    """Tests for GroupInviteListView."""

    def test_list_my_invites(self):
        self.client.force_authenticate(user=self.other_user)
        GroupInvite.objects.create(
            group=self.group,
            invited_by=self.user,
            invited_user=self.other_user,
            token="tok",
            expires_at=timezone.now() + timedelta(days=7),
        )
        url = reverse("study_groups:invite-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class GroupChallengeListCreateViewTest(BaseStudyGroupTest):
    """Tests for GroupChallengeListCreateView."""

    def test_list_challenges(self):
        url = reverse(
            "study_groups:challenge-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_challenge(self):
        url = reverse(
            "study_groups:challenge-list", args=[self.group.id]
        )
        data = {
            "title": "Sprint",
            "description": "10 lessons",
            "target_value": 10,
            "target_type": "lessons",
            "start_date": timezone.now().isoformat(),
            "end_date": (timezone.now() + timedelta(days=7)).isoformat(),
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class ChallengeJoinViewTest(BaseStudyGroupTest):
    """Tests for ChallengeJoinView."""

    def setUp(self):
        super().setUp()
        self.challenge = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="Test",
            description="",
            status="active",
            target_value=10,
            start_date=timezone.now() - timedelta(days=1),
            end_date=timezone.now() + timedelta(days=6),
        )

    def test_join_challenge(self):
        url = reverse(
            "study_groups:challenge-join",
            args=[self.group.id, self.challenge.id],
        )
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_join_already_participating(self):
        url = reverse(
            "study_groups:challenge-join",
            args=[self.group.id, self.challenge.id],
        )
        self.client.post(url)
        response = self.client.post(url)
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST
        )


class ChallengeLeaderboardViewTest(BaseStudyGroupTest):
    """Tests for ChallengeLeaderboardView."""

    def test_get_leaderboard(self):
        challenge = GroupChallenge.objects.create(
            group=self.group,
            created_by=self.user,
            title="LB",
            description="",
            target_value=10,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=7),
        )
        GroupChallengeParticipant.objects.create(
            challenge=challenge,
            user=self.user,
            current_value=8,
        )
        url = reverse(
            "study_groups:challenge-leaderboard",
            args=[self.group.id, challenge.id],
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class GroupGoalListCreateViewTest(BaseStudyGroupTest):
    """Tests for GroupGoalListCreateView."""

    def test_list_goals(self):
        url = reverse(
            "study_groups:goal-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_goal(self):
        url = reverse(
            "study_groups:goal-list", args=[self.group.id]
        )
        data = {
            "goal_type": "total_xp",
            "title": "1000 XP",
            "target_value": 1000,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class GroupMessageListCreateViewTest(BaseStudyGroupTest):
    """Tests for GroupMessageListCreateView."""

    def test_list_messages(self):
        GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Hello",
        )
        url = reverse(
            "study_groups:message-list", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_post_message(self):
        url = reverse(
            "study_groups:message-list", args=[self.group.id]
        )
        data = {"content": "Study tips?"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class MessageReplyListViewTest(BaseStudyGroupTest):
    """Tests for MessageReplyListView."""

    def test_list_replies(self):
        parent = GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="Q?",
        )
        GroupMessage.objects.create(
            group=self.group,
            user=self.user,
            content="A!",
            parent=parent,
        )
        url = reverse(
            "study_groups:message-replies", args=[parent.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)


class GroupStatsViewTest(BaseStudyGroupTest):
    """Tests for GroupStatsView."""

    def test_get_stats(self):
        url = reverse(
            "study_groups:group-stats", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("member_count", response.data)

    def test_nonexistent_group(self):
        url = reverse("study_groups:group-stats", args=[9999])
        response = self.client.get(url)
        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )


class GroupLeaderboardViewTest(BaseStudyGroupTest):
    """Tests for GroupLeaderboardView."""

    def test_get_leaderboard(self):
        url = reverse(
            "study_groups:group-leaderboard", args=[self.group.id]
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("entries", response.data)

    def test_weekly_leaderboard(self):
        url = reverse(
            "study_groups:group-leaderboard", args=[self.group.id]
        )
        response = self.client.get(url, {"period": "weekly"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class GroupDiscoverViewTest(BaseStudyGroupTest):
    """Tests for GroupDiscoverView."""

    def test_discover(self):
        url = reverse("study_groups:group-discover")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_discover_with_category(self):
        StudyGroup.objects.create(
            name="Python",
            slug="py",
            owner=self.other_user,
            visibility="public",
            category="python",
        )
        url = reverse("study_groups:group-discover")
        response = self.client.get(url, {"category": "python"})
        self.assertEqual(len(response.data["groups"]), 1)


class PlatformGroupStatsViewTest(BaseStudyGroupTest):
    """Tests for PlatformGroupStatsView."""

    def test_platform_stats(self):
        url = reverse("study_groups:platform-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_groups", response.data)
