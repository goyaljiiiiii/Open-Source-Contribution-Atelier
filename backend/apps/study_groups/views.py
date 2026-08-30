"""
DRF views for the Study Groups & Collaborative Learning app.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    GroupActivity,
    GroupChallenge,
    GroupChallengeParticipant,
    GroupGoal,
    GroupInvite,
    GroupMessage,
    GroupMembership,
    GroupResource,
    StudyGroup,
)
from .serializers import (
    GroupActivitySerializer,
    GroupChallengeParticipantSerializer,
    GroupChallengeSerializer,
    GroupGoalSerializer,
    GroupInviteSerializer,
    GroupLeaderboardSerializer,
    GroupMembershipSerializer,
    GroupMessageSerializer,
    GroupResourceSerializer,
    GroupStatsSerializer,
    InviteAcceptSerializer,
    InviteCreateSerializer,
    PlatformGroupStatsSerializer,
    StudyGroupCreateSerializer,
    StudyGroupSerializer,
)
from .services import (
    accept_invite,
    create_invite,
    discover_groups,
    get_group_leaderboard,
    get_group_stats,
    get_platform_group_stats,
    record_group_activity,
)


# ---------------------------------------------------------------------------
#  Group CRUD
# ---------------------------------------------------------------------------


class StudyGroupListCreateView(generics.ListCreateAPIView):
    """List user's groups or create a new group."""

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return StudyGroupCreateSerializer
        return StudyGroupSerializer

    def get_queryset(self):
        return StudyGroup.objects.filter(
            memberships__user=self.request.user,
            memberships__status="active",
        ).select_related("owner")

    def perform_create(self, serializer):
        from .models import GroupMembership

        group = serializer.save(owner=self.request.user)
        GroupMembership.objects.create(
            user=self.request.user,
            group=group,
            role="owner",
        )


class StudyGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a study group."""

    serializer_class = StudyGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StudyGroup.objects.filter(
            memberships__user=self.request.user,
        )

    def perform_update(self, serializer):
        group = self.get_object()
        if group.owner != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Only the owner can update the group.")
        serializer.save()


# ---------------------------------------------------------------------------
#  Membership
# ---------------------------------------------------------------------------


class GroupMemberListView(generics.ListAPIView):
    """List members of a study group."""

    serializer_class = GroupMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs["group_id"]
        return GroupMembership.objects.filter(
            group_id=group_id,
            status="active",
        ).select_related("user")


class JoinGroupView(views.APIView):
    """Join a public study group."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = StudyGroup.objects.get(id=group_id)
        except StudyGroup.DoesNotExist:
            return Response(
                {"error": "Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if group.visibility != "public":
            return Response(
                {"error": "This group requires an invite."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if group.is_full:
            return Response(
                {"error": "Group is full."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if GroupMembership.objects.filter(
            group=group, user=request.user
        ).exists():
            return Response(
                {"error": "Already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            membership = GroupMembership.objects.create(
                user=request.user, group=group
            )
            StudyGroup.objects.filter(id=group.id).update(
                member_count=F("member_count") + 1
            )
            record_group_activity(
                group=group,
                user=request.user,
                activity_type="join",
                title=f"{request.user.username} joined the group!",
            )

        return Response(
            GroupMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


class LeaveGroupView(views.APIView):
    """Leave a study group."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id):
        try:
            membership = GroupMembership.objects.get(
                group_id=group_id,
                user=request.user,
                status="active",
            )
        except GroupMembership.DoesNotExist:
            return Response(
                {"error": "Not a member."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if membership.role == "owner":
            return Response(
                {"error": "Owner cannot leave. Transfer ownership first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            membership.delete()
            StudyGroup.objects.filter(id=group_id).update(
                member_count=F("member_count") - 1
            )
            record_group_activity(
                group=membership.group,
                user=request.user,
                activity_type="leave",
                title=f"{request.user.username} left the group.",
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
#  Resources
# ---------------------------------------------------------------------------


class GroupResourceListCreateView(generics.ListCreateAPIView):
    """List or share resources in a group."""

    serializer_class = GroupResourceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupResource.objects.filter(
            group_id=self.kwargs["group_id"],
        ).select_related("shared_by")

    def perform_create(self, serializer):
        serializer.save(
            group_id=self.kwargs["group_id"],
            shared_by=self.request.user,
        )
        record_group_activity(
            group_id=self.kwargs["group_id"],
            user=self.request.user,
            activity_type="resource",
            title=f"Shared: {serializer.instance.title}",
        )


class ResourceUpvoteView(views.APIView):
    """Upvote a group resource."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id, resource_id):
        from .models import GroupResource

        updated = GroupResource.objects.filter(
            id=resource_id,
            group_id=group_id,
        ).update(upvotes=F("upvotes") + 1)

        if not updated:
            return Response(
                {"error": "Resource not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"upvoted": True})


# ---------------------------------------------------------------------------
#  Activities / Feed
# ---------------------------------------------------------------------------


class GroupActivityListView(generics.ListAPIView):
    """List recent activities in a group."""

    serializer_class = GroupActivitySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return GroupActivity.objects.filter(
            group_id=self.kwargs["group_id"],
        ).select_related("user")


# ---------------------------------------------------------------------------
#  Invites
# ---------------------------------------------------------------------------


class GroupInviteCreateView(views.APIView):
    """Create an invite to a group."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = StudyGroup.objects.get(id=group_id)
        except StudyGroup.DoesNotExist:
            return Response(
                {"error": "Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        membership = GroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership or not membership.is_officer:
            return Response(
                {"error": "Only admins+ can send invites."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invited_user = None
        email = serializer.validated_data.get("email", "")
        if serializer.validated_data.get("user_id"):
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                invited_user = User.objects.get(
                    id=serializer.validated_data["user_id"]
                )
            except User.DoesNotExist:
                return Response(
                    {"error": "User not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        result = create_invite(
            group=group,
            invited_by=request.user,
            invited_user=invited_user,
            email=email,
        )

        return Response(result, status=status.HTTP_201_CREATED)


class AcceptInviteView(views.APIView):
    """Accept a group invite using the invite token."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InviteAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = accept_invite(
            token=serializer.validated_data["token"],
            user=request.user,
        )

        if "error" in result:
            return Response(
                result, status=status.HTTP_400_BAD_REQUEST
            )

        return Response(result)


class GroupInviteListView(generics.ListAPIView):
    """List pending invites for the user."""

    serializer_class = GroupInviteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupInvite.objects.filter(
            invited_user=self.request.user,
            status="pending",
        ).select_related("group", "invited_by")


# ---------------------------------------------------------------------------
#  Challenges
# ---------------------------------------------------------------------------


class GroupChallengeListCreateView(generics.ListCreateAPIView):
    """List or create group challenges."""

    serializer_class = GroupChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupChallenge.objects.filter(
            group_id=self.kwargs["group_id"],
        ).select_related("created_by")

    def perform_create(self, serializer):
        serializer.save(
            group_id=self.kwargs["group_id"],
            created_by=self.request.user,
        )


class ChallengeJoinView(views.APIView):
    """Join a group challenge."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id, challenge_id):
        try:
            challenge = GroupChallenge.objects.get(
                id=challenge_id,
                group_id=group_id,
                status="active",
            )
        except GroupChallenge.DoesNotExist:
            return Response(
                {"error": "Challenge not found or not active."},
                status=status.HTTP_404_NOT_FOUND,
            )

        participant, created = GroupChallengeParticipant.objects.get_or_create(
            challenge=challenge,
            user=request.user,
        )

        if not created:
            return Response(
                {"error": "Already participating."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            GroupChallengeParticipantSerializer(participant).data,
            status=status.HTTP_201_CREATED,
        )


class ChallengeLeaderboardView(views.APIView):
    """Get the leaderboard for a group challenge."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id, challenge_id):
        participants = GroupChallengeParticipant.objects.filter(
            challenge_id=challenge_id,
            challenge__group_id=group_id,
        ).select_related("user").order_by("-current_value")

        return Response(
            GroupChallengeParticipantSerializer(participants, many=True).data
        )


# ---------------------------------------------------------------------------
#  Goals
# ---------------------------------------------------------------------------


class GroupGoalListCreateView(generics.ListCreateAPIView):
    """List or create group goals."""

    serializer_class = GroupGoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupGoal.objects.filter(
            group_id=self.kwargs["group_id"],
        )


# ---------------------------------------------------------------------------
#  Messages / Discussion
# ---------------------------------------------------------------------------


class GroupMessageListCreateView(generics.ListCreateAPIView):
    """List or post messages in group discussion."""

    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupMessage.objects.filter(
            group_id=self.kwargs["group_id"],
            parent__isnull=True,
        ).select_related("user")

    def perform_create(self, serializer):
        serializer.save(
            group_id=self.kwargs["group_id"],
            user=self.request.user,
        )


class MessageReplyListView(generics.ListAPIView):
    """List replies to a specific message."""

    serializer_class = GroupMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupMessage.objects.filter(
            parent_id=self.kwargs["message_id"],
        ).select_related("user")


# ---------------------------------------------------------------------------
#  Stats & Discovery
# ---------------------------------------------------------------------------


class GroupStatsView(views.APIView):
    """Get comprehensive stats for a group."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        try:
            group = StudyGroup.objects.get(id=group_id)
        except StudyGroup.DoesNotExist:
            return Response(
                {"error": "Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        stats = get_group_stats(group)
        return Response(GroupStatsSerializer(stats).data)


class GroupLeaderboardView(views.APIView):
    """Get the group leaderboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        period = request.query_params.get("period", "all_time")
        try:
            group = StudyGroup.objects.get(id=group_id)
        except StudyGroup.DoesNotExist:
            return Response(
                {"error": "Group not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        leaderboard = get_group_leaderboard(group, period=period)
        return Response(
            {
                "period": period,
                "entries": leaderboard,
            }
        )


class GroupDiscoverView(views.APIView):
    """Discover public study groups."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        category = request.query_params.get("category")
        search = request.query_params.get("search")
        groups = discover_groups(
            request.user,
            category=category,
            search=search,
        )
        return Response(
            {
                "groups": groups,
                "total": len(groups),
            }
        )


class PlatformGroupStatsView(views.APIView):
    """Get platform-wide study group statistics."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        stats = get_platform_group_stats()
        return Response(PlatformGroupStatsSerializer(stats).data)
