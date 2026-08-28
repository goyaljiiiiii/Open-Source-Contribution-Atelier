"""
Study Groups services.

Group analytics, leaderboard computation, activity tracking,
and collective goal progress updates.
"""

from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import (
    Avg,
    Count,
    F,
    Max,
    Sum,
)
from django.utils import timezone

User = get_user_model()


# ---------------------------------------------------------------------------
#  Group Analytics
# ---------------------------------------------------------------------------

def get_group_stats(group) -> dict[str, Any]:
    """Compute comprehensive stats for a study group."""
    from .models import GroupActivity, GroupChallenge, GroupMembership

    now = timezone.now()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    members = GroupMembership.objects.filter(
        group=group, status="active"
    )

    # Activity in the last 7 days
    recent_activities = GroupActivity.objects.filter(
        group=group, created_at__gte=week_ago
    )

    # Active members this week (users who had any activity)
    active_this_week = (
        recent_activities.values("user").distinct().count()
    )

    # Member contributions leaderboard
    leaderboard = list(
        members.select_related("user")
        .order_by("-total_xp_contributed")[:20]
        .values(
            "user__id",
            "user__username",
            "nickname",
            "total_xp_contributed",
            "total_minutes_contributed",
            "lessons_completed",
            "quizzes_passed",
        )
    )

    # XP earned this week
    weekly_xp = (
        recent_activities.filter(activity_type="xp").aggregate(
            total=Sum("xp_value")
        )["total"]
        or 0
    )

    # Top resource
    from .models import GroupResource

    top_resource = (
        GroupResource.objects.filter(group=group)
        .order_by("-upvotes")
        .first()
    )

    # Active challenges
    active_challenges = GroupChallenge.objects.filter(
        group=group, status="active"
    ).count()

    return {
        "member_count": members.count(),
        "active_this_week": active_this_week,
        "total_xp": group.total_xp,
        "weekly_xp": weekly_xp,
        "streak_days": group.streak_days,
        "lessons_completed": sum(
            m.lessons_completed for m in members
        ),
        "leaderboard": leaderboard,
        "active_challenges": active_challenges,
        "top_resource": {
            "id": top_resource.id,
            "title": top_resource.title,
            "upvotes": top_resource.upvotes,
        }
        if top_resource
        else None,
    }


# ---------------------------------------------------------------------------
#  Activity Tracking
# ---------------------------------------------------------------------------

def record_group_activity(
    group,
    user,
    activity_type: str,
    title: str,
    description: str = "",
    xp_value: int = 0,
    metadata: dict | None = None,
) -> "GroupActivity":
    """Record an activity in the group feed and update member stats."""
    from .models import GroupActivity, GroupMembership

    activity = GroupActivity.objects.create(
        group=group,
        user=user,
        activity_type=activity_type,
        title=title,
        description=description,
        xp_value=xp_value,
        metadata=metadata or {},
    )

    # Update member contribution stats
    membership = GroupMembership.objects.filter(
        group=group, user=user
    ).first()
    if membership:
        update_fields = ["last_active"]
        if activity_type == "lesson":
            membership.lessons_completed = F("lessons_completed") + 1
            update_fields.append("lessons_completed")
        elif activity_type == "quiz":
            membership.quizzes_passed = F("quizzes_passed") + 1
            update_fields.append("quizzes_passed")
        elif activity_type == "xp":
            membership.total_xp_contributed = F(
                "total_xp_contributed"
            ) + xp_value
            update_fields.append("total_xp_contributed")
        membership.save(update_fields=update_fields)

    # Update group aggregate XP
    if xp_value > 0:
        from .models import StudyGroup

        StudyGroup.objects.filter(id=group.id).update(
            total_xp=F("total_xp") + xp_value
        )

    # Check group goals
    _check_group_goals(group)

    return activity


def _check_group_goals(group):
    """Check and update group goals after an activity."""
    from .models import GroupGoal

    active_goals = GroupGoal.objects.filter(
        group=group, is_completed=False
    )

    for goal in active_goals:
        _update_goal_progress(group, goal)


def _update_goal_progress(group, goal):
    """Update a single group goal's progress."""
    from .models import GroupGoal, GroupMembership

    if goal.goal_type == "total_xp":
        goal.current_value = group.total_xp
    elif goal.goal_type == "lesson_count":
        goal.current_value = GroupMembership.objects.filter(
            group=group
        ).aggregate(total=Sum("lessons_completed"))["total"] or 0
    elif goal.goal_type == "member_active":
        week_ago = timezone.now() - timedelta(days=7)
        from .models import GroupActivity

        goal.current_value = (
            GroupActivity.objects.filter(
                group=group, created_at__gte=week_ago
            )
            .values("user")
            .distinct()
            .count()
        )
    elif goal.goal_type == "quiz_average":
        goal.current_value = int(
            GroupMembership.objects.filter(group=group).aggregate(
                avg=Avg("quizzes_passed")
            )["avg"]
            or 0
        )

    if (
        goal.current_value >= goal.target_value
        and not goal.is_completed
    ):
        goal.is_completed = True
        goal.save()
    else:
        goal.save(update_fields=["current_value", "updated_at"])


# ---------------------------------------------------------------------------
#  Group Leaderboard
# ---------------------------------------------------------------------------

def get_group_leaderboard(group, period="all_time") -> list[dict[str, Any]]:
    """Return the group leaderboard for the specified period."""
    from .models import GroupActivity, GroupMembership

    members = GroupMembership.objects.filter(
        group=group, status="active"
    ).select_related("user")

    if period == "weekly":
        week_ago = timezone.now() - timedelta(days=7)
        activities = GroupActivity.objects.filter(
            group=group,
            activity_type="xp",
            created_at__gte=week_ago,
        )
        xp_by_user = dict(
            activities.values("user_id")
            .annotate(total=Sum("xp_value"))
            .values_list("user_id", "total")
        )

        leaderboard = []
        for m in members:
            xp = xp_by_user.get(m.user_id, 0)
            leaderboard.append({
                "user_id": m.user_id,
                "username": m.user.username,
                "nickname": m.nickname or m.user.username,
                "xp": xp,
                "role": m.role,
            })
        leaderboard.sort(key=lambda x: x["xp"], reverse=True)

    elif period == "monthly":
        month_ago = timezone.now() - timedelta(days=30)
        activities = GroupActivity.objects.filter(
            group=group,
            activity_type="xp",
            created_at__gte=month_ago,
        )
        xp_by_user = dict(
            activities.values("user_id")
            .annotate(total=Sum("xp_value"))
            .values_list("user_id", "total")
        )

        leaderboard = []
        for m in members:
            xp = xp_by_user.get(m.user_id, 0)
            leaderboard.append({
                "user_id": m.user_id,
                "username": m.user.username,
                "nickname": m.nickname or m.user.username,
                "xp": xp,
                "role": m.role,
            })
        leaderboard.sort(key=lambda x: x["xp"], reverse=True)

    else:  # all_time
        leaderboard = [
            {
                "user_id": m.user_id,
                "username": m.user.username,
                "nickname": m.nickname or m.user.username,
                "xp": m.total_xp_contributed,
                "lessons": m.lessons_completed,
                "quizzes": m.quizzes_passed,
                "minutes": m.total_minutes_contributed,
                "role": m.role,
            }
            for m in members
        ]
        leaderboard.sort(key=lambda x: x["xp"], reverse=True)

    return leaderboard


# ---------------------------------------------------------------------------
#  Invite System
# ---------------------------------------------------------------------------

def create_invite(group, invited_by, invited_user=None, email="") -> dict:
    """Create an invite token for a study group."""
    from .models import GroupInvite

    token = secrets.token_urlsafe(32)
    expires = timezone.now() + timedelta(days=7)

    invite = GroupInvite.objects.create(
        group=group,
        invited_by=invited_by,
        invited_user=invited_user,
        email=email,
        token=token,
        expires_at=expires,
    )

    return {
        "invite_id": invite.id,
        "token": token,
        "expires_at": expires.isoformat(),
    }


def accept_invite(token: str, user) -> dict:
    """Accept a group invite and add the user as a member."""
    from .models import GroupInvite, GroupMembership, StudyGroup

    try:
        invite = GroupInvite.objects.get(token=token)
    except GroupInvite.DoesNotExist:
        return {"error": "Invalid invite token."}

    if invite.is_expired:
        invite.status = "expired"
        invite.save(update_fields=["status"])
        return {"error": "Invite has expired."}

    if invite.status != "pending":
        return {"error": f"Invite is already {invite.status}."}

    group = invite.group
    if group.is_full:
        return {"error": "This group is full."}

    if GroupMembership.objects.filter(
        group=group, user=user
    ).exists():
        return {"error": "You are already a member."}

    with transaction.atomic():
        membership = GroupMembership.objects.create(
            user=user,
            group=group,
            role="member",
        )
        invite.status = "accepted"
        invite.invited_user = user
        invite.save(update_fields=["status", "invited_user"])

        StudyGroup.objects.filter(id=group.id).update(
            member_count=F("member_count") + 1
        )

        record_group_activity(
            group=group,
            user=user,
            activity_type="join",
            title=f"{user.username} joined the group!",
        )

    return {
        "success": True,
        "group_name": group.name,
        "role": membership.role,
    }


# ---------------------------------------------------------------------------
#  Group Discovery
# ---------------------------------------------------------------------------

def discover_groups(user, category=None, search=None) -> list[dict]:
    """Find public groups for the user to join."""
    from .models import StudyGroup

    qs = StudyGroup.objects.filter(
        visibility="public",
        is_archived=False,
    ).exclude(
        members__user=user,
    )

    if category:
        qs = qs.filter(category=category)

    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(description__icontains=search)
        )

    return [
        {
            "id": g.id,
            "name": g.name,
            "slug": g.slug,
            "description": g.description,
            "category": g.category,
            "icon_emoji": g.icon_emoji,
            "color": g.color,
            "member_count": g.member_count,
            "total_xp": g.total_xp,
            "streak_days": g.streak_days,
        }
        for g in qs[:50]
    ]


# ---------------------------------------------------------------------------
#  Global Group Stats
# ---------------------------------------------------------------------------

def get_platform_group_stats() -> dict[str, Any]:
    """Aggregate statistics across all study groups."""
    from .models import StudyGroup

    groups = StudyGroup.objects.filter(is_archived=False)
    return {
        "total_groups": groups.count(),
        "total_members": (
            groups.aggregate(total=Sum("member_count"))["total"] or 0
        ),
        "total_xp": (
            groups.aggregate(total=Sum("total_xp"))["total"] or 0
        ),
        "public_groups": groups.filter(visibility="public").count(),
        "private_groups": groups.filter(visibility="private").count(),
        "invite_only": groups.filter(visibility="invite_only").count(),
        "top_categories": list(
            groups.values("category")
            .annotate(count=Count("id"))
            .order_by("-count")
            .values_list("category", "count")[:5]
        ),
    }
