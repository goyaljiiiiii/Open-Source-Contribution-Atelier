"""
URL patterns for the Study Groups app.
"""

from django.urls import path

from .views import (
    AcceptInviteView,
    ChallengeJoinView,
    ChallengeLeaderboardView,
    GroupActivityListView,
    GroupChallengeListCreateView,
    GroupDiscoverView,
    GroupGoalListCreateView,
    GroupInviteCreateView,
    GroupInviteListView,
    GroupLeaderboardView,
    GroupMemberListView,
    GroupMessageListCreateView,
    GroupResourceListCreateView,
    GroupStatsView,
    JoinGroupView,
    LeaveGroupView,
    MessageReplyListView,
    PlatformGroupStatsView,
    ResourceUpvoteView,
    StudyGroupDetailView,
    StudyGroupListCreateView,
)

app_name = "study_groups"

urlpatterns = [
    # ── Groups CRUD ───────────────────────────────────────────────────────
    path(
        "",
        StudyGroupListCreateView.as_view(),
        name="group-list",
    ),
    path(
        "<int:pk>/",
        StudyGroupDetailView.as_view(),
        name="group-detail",
    ),
    path(
        "discover/",
        GroupDiscoverView.as_view(),
        name="group-discover",
    ),
    path(
        "platform-stats/",
        PlatformGroupStatsView.as_view(),
        name="platform-stats",
    ),
    # ── Membership ────────────────────────────────────────────────────────
    path(
        "<int:group_id>/members/",
        GroupMemberListView.as_view(),
        name="member-list",
    ),
    path(
        "<int:group_id>/join/",
        JoinGroupView.as_view(),
        name="join-group",
    ),
    path(
        "<int:group_id>/leave/",
        LeaveGroupView.as_view(),
        name="leave-group",
    ),
    # ── Resources ─────────────────────────────────────────────────────────
    path(
        "<int:group_id>/resources/",
        GroupResourceListCreateView.as_view(),
        name="resource-list",
    ),
    path(
        "<int:group_id>/resources/<int:resource_id>/upvote/",
        ResourceUpvoteView.as_view(),
        name="resource-upvote",
    ),
    # ── Activities ────────────────────────────────────────────────────────
    path(
        "<int:group_id>/activities/",
        GroupActivityListView.as_view(),
        name="activity-list",
    ),
    # ── Invites ───────────────────────────────────────────────────────────
    path(
        "<int:group_id>/invites/",
        GroupInviteCreateView.as_view(),
        name="invite-create",
    ),
    path(
        "invites/accept/",
        AcceptInviteView.as_view(),
        name="invite-accept",
    ),
    path(
        "invites/mine/",
        GroupInviteListView.as_view(),
        name="invite-list",
    ),
    # ── Challenges ────────────────────────────────────────────────────────
    path(
        "<int:group_id>/challenges/",
        GroupChallengeListCreateView.as_view(),
        name="challenge-list",
    ),
    path(
        "<int:group_id>/challenges/<int:challenge_id>/join/",
        ChallengeJoinView.as_view(),
        name="challenge-join",
    ),
    path(
        "<int:group_id>/challenges/<int:challenge_id>/leaderboard/",
        ChallengeLeaderboardView.as_view(),
        name="challenge-leaderboard",
    ),
    # ── Goals ─────────────────────────────────────────────────────────────
    path(
        "<int:group_id>/goals/",
        GroupGoalListCreateView.as_view(),
        name="goal-list",
    ),
    # ── Messages ──────────────────────────────────────────────────────────
    path(
        "<int:group_id>/messages/",
        GroupMessageListCreateView.as_view(),
        name="message-list",
    ),
    path(
        "messages/<int:message_id>/replies/",
        MessageReplyListView.as_view(),
        name="message-replies",
    ),
    # ── Stats ─────────────────────────────────────────────────────────────
    path(
        "<int:group_id>/stats/",
        GroupStatsView.as_view(),
        name="group-stats",
    ),
    path(
        "<int:group_id>/leaderboard/",
        GroupLeaderboardView.as_view(),
        name="group-leaderboard",
    ),
]
