"""
Mentorship services.

Implements the mentor matching algorithm, session analytics,
XP distribution, and mentorship program reporting.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import (
    Avg,
    Count,
    F,
    Q,
    Sum,
)
from django.utils import timezone

User = get_user_model()


# ---------------------------------------------------------------------------
#  Matching Algorithm
# ---------------------------------------------------------------------------

def find_mentors(
    user,
    skill_slug: str = "",
    min_rating: float = 0.0,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Find suitable mentors for a user based on skill and availability.

    Scoring criteria:
    - Expertise match (skill slug overlap): up to 40 points
    - Rating: up to 30 points
    - Availability (has capacity): up to 20 points
    - Activity recency: up to 10 points
    """
    from .models import MentorProfile

    candidates = MentorProfile.objects.filter(
        is_active=True,
        availability__in=["available", "busy"],
    ).exclude(
        user=user,
    ).select_related("user")

    if min_rating > 0:
        candidates = candidates.filter(average_rating__gte=min_rating)

    results = []
    now = timezone.now()

    for profile in candidates:
        score = 0.0

        # 1. Expertise match (40 points)
        expertise = profile.expertise_areas or []
        if skill_slug and skill_slug in expertise:
            score += 40
        elif skill_slug:
            # Partial match: check if any expertise area overlaps
            overlap = set(expertise) & set(_expand_skill_parents(skill_slug))
            if overlap:
                score += 20

        # 2. Rating (30 points)
        score += (profile.average_rating / 5.0) * 30

        # 3. Availability capacity (20 points)
        if not profile.is_full:
            capacity_ratio = 1 - (
                profile.current_mentee_count / profile.max_mentees
            )
            score += capacity_ratio * 20

        # 4. Activity recency (10 points)
        from apps.learning_analytics.models import LearningSession

        recent = LearningSession.objects.filter(
            user=profile.user,
            started_at__gte=now - timedelta(days=14),
        ).exists()
        if recent:
            score += 10

        results.append({
            "mentor_profile": profile,
            "user": profile.user,
            "score": round(score, 1),
            "expertise": expertise,
            "rating": profile.average_rating,
            "sessions": profile.total_sessions_mentored,
            "capacity": (
                profile.max_mentees - profile.current_mentee_count
            ),
            "is_full": profile.is_full,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def _expand_skill_parents(slug: str) -> list[str]:
    """Expand a skill slug to include potential parent categories."""
    expansions = {
        "git-branching": ["git-basics", "git"],
        "django-orm": ["django", "python"],
        "react-hooks": ["react", "javascript"],
        "docker-compose": ["docker", "devops"],
        "rest-api": ["api-design", "backend"],
        "pytest": ["testing", "python"],
    }
    return expansions.get(slug, [slug])


# ---------------------------------------------------------------------------
#  Request Processing
# ---------------------------------------------------------------------------

def create_mentorship_request(
    mentee,
    mentor_id: int,
    subject: str,
    message: str = "",
    skill_wanted: str = "",
    preferred_frequency: str = "weekly",
) -> dict[str, Any]:
    """Create a mentorship request from mentee to mentor."""
    from .models import MentorProfile, MentorshipRequest

    try:
        mentor_profile = MentorProfile.objects.get(
            user_id=mentor_id,
            is_active=True,
        )
    except MentorProfile.DoesNotExist:
        return {"error": "Mentor not found or inactive."}

    if mentor_profile.user == mentee:
        return {"error": "You cannot request mentorship from yourself."}

    if mentor_profile.is_full:
        return {"error": "This mentor has reached their mentee capacity."}

    # Check for existing active request
    existing = MentorshipRequest.objects.filter(
        mentee=mentee,
        mentor=mentor_profile.user,
        status__in=["pending", "accepted"],
    ).exists()
    if existing:
        return {"error": "You already have an active request with this mentor."}

    request = MentorshipRequest.objects.create(
        mentee=mentee,
        mentor=mentor_profile.user,
        subject=subject,
        message=message,
        skill_wanted=skill_wanted,
        preferred_frequency=preferred_frequency,
        expires_at=timezone.now() + timedelta(days=7),
    )

    return {
        "request_id": request.id,
        "status": request.status,
        "expires_at": request.expires_at.isoformat(),
    }


def respond_to_request(
    mentor,
    request_id: int,
    accept: bool,
    response_message: str = "",
) -> dict[str, Any]:
    """Mentor accepts or declines a mentorship request."""
    from .models import MentorProfile, MentorshipMatch, MentorshipRequest

    try:
        req = MentorshipRequest.objects.get(
            id=request_id,
            mentor=mentor,
            status="pending",
        )
    except MentorshipRequest.DoesNotExist:
        return {"error": "Request not found or already processed."}

    if req.is_expired:
        req.status = "expired"
        req.save(update_fields=["status"])
        return {"error": "Request has expired."}

    if accept:
        req.status = "accepted"
        req.response_message = response_message
        req.responded_at = timezone.now()
        req.save(update_fields=[
            "status", "response_message", "responded_at",
        ])

        # Create the match
        match = MentorshipMatch.objects.create(
            mentor=mentor,
            mentee=req.mentee,
            request=req,
            skill_focus=req.skill_wanted,
        )

        # Update mentor mentee count
        profile = MentorProfile.objects.get(user=mentor)
        profile.current_mentee_count += 1
        profile.save(update_fields=["current_mentee_count"])

        return {
            "success": True,
            "match_id": match.id,
            "status": "accepted",
        }
    else:
        req.status = "declined"
        req.response_message = response_message
        req.responded_at = timezone.now()
        req.save(update_fields=[
            "status", "response_message", "responded_at",
        ])
        return {"success": True, "status": "declined"}


# ---------------------------------------------------------------------------
#  Session Management
# ---------------------------------------------------------------------------

def complete_session(
    session_id: int,
    mentor,
    mentor_rating: int = None,
    mentee_rating: int = None,
    mentor_feedback: str = "",
    mentee_feedback: str = "",
    topics_covered: list | None = None,
    action_items: list | None = None,
) -> dict[str, Any]:
    """Complete a mentorship session with ratings and feedback."""
    from .models import MentorshipSession

    try:
        session = MentorshipSession.objects.get(
            id=session_id,
            mentor=mentor,
        )
    except MentorshipSession.DoesNotExist:
        return {"error": "Session not found."}

    with transaction.atomic():
        session.complete_session()

        if topics_covered is not None:
            session.topics_covered = topics_covered
        if action_items is not None:
            session.action_items = action_items
        if mentor_rating:
            session.mentor_rating = mentor_rating
            session.mentor_feedback = mentor_feedback
        if mentee_rating:
            session.mentee_rating = mentee_rating
            session.mentee_feedback = mentee_feedback

        # XP calculation
        base_xp = max(10, session.duration_minutes)
        mentor_xp = int(base_xp * 1.5)  # Mentors earn more
        mentee_xp = base_xp

        session.xp_awarded_mentor = mentor_xp
        session.xp_awarded_mentee = mentee_xp
        session.save()

        # Award XP to match totals
        match = session.match
        match.mentor_xp_earned += mentor_xp
        match.mentee_xp_earned += mentee_xp
        match.save(update_fields=[
            "mentor_xp_earned", "mentee_xp_earned",
        ])

    return {
        "success": True,
        "session_id": session.id,
        "duration_minutes": session.duration_minutes,
        "xp_awarded_mentor": mentor_xp,
        "xp_awarded_mentee": mentee_xp,
    }


# ---------------------------------------------------------------------------
#  Analytics
# ---------------------------------------------------------------------------

def get_mentor_analytics(mentor) -> dict[str, Any]:
    """Comprehensive analytics for a mentor's program."""
    from .models import MentorProfile, MentorshipMatch, MentorshipSession

    profile = MentorProfile.objects.get(user=mentor)
    matches = MentorshipMatch.objects.filter(mentor=mentor)
    sessions = MentorshipSession.objects.filter(
        mentor=mentor, status="completed"
    )

    active_matches = matches.filter(status="active").count()
    total_sessions = sessions.count()

    if total_sessions == 0:
        return {
            "active_mentees": active_matches,
            "total_sessions": 0,
            "total_hours": 0,
            "average_rating": 0,
            "rating_count": 0,
            "avg_session_duration": 0,
            "sessions_this_month": 0,
            "top_topics": [],
            "xp_earned": 0,
            "acceptance_rate": profile.acceptance_rate,
        }

    # Sessions this month
    month_ago = timezone.now() - timedelta(days=30)
    sessions_this_month = sessions.filter(
        created_at__gte=month_ago
    ).count()

    # Top topics
    all_topics = []
    for s in sessions.values_list("topics_covered", flat=True):
        all_topics.extend(s or [])
    topic_counts = defaultdict(int)
    for t in all_topics:
        topic_counts[t] += 1
    top_topics = sorted(
        topic_counts.items(), key=lambda x: x[1], reverse=True
    )[:10]

    agg = sessions.aggregate(
        avg_duration=Avg("duration_minutes"),
        total_xp=Sum("xp_awarded_mentor"),
    )

    return {
        "active_mentees": active_matches,
        "total_sessions": total_sessions,
        "total_hours": round(profile.total_hours_mentored, 1),
        "average_rating": profile.average_rating,
        "rating_count": profile.rating_count,
        "avg_session_duration": round(agg["avg_duration"] or 0, 1),
        "sessions_this_month": sessions_this_month,
        "top_topics": [{"topic": t, "count": c} for t, c in top_topics],
        "xp_earned": agg["total_xp"] or 0,
        "acceptance_rate": profile.acceptance_rate,
    }


def get_mentee_analytics(mentee) -> dict[str, Any]:
    """Analytics for a mentee's mentorship journey."""
    from .models import MentorshipMatch, MentorshipSession

    matches = MentorshipMatch.objects.filter(mentee=mentee)
    sessions = MentorshipSession.objects.filter(
        mentee=mentee, status="completed"
    )

    active = matches.filter(status="active")
    total = sessions.count()

    if total == 0:
        return {
            "active_mentors": active.count(),
            "total_sessions": 0,
            "total_hours": 0,
            "xp_earned": 0,
            "skills_learned": [],
            "sessions_this_month": 0,
        }

    month_ago = timezone.now() - timedelta(days=30)
    sessions_this_month = sessions.filter(
        created_at__gte=month_ago
    ).count()

    skills = list(
        matches.values_list("skill_focus", flat=True).distinct()
    )
    skills = [s for s in skills if s]

    total_minutes = sessions.aggregate(
        total=Sum("duration_minutes")
    )["total"] or 0
    xp = sessions.aggregate(total=Sum("xp_awarded_mentee"))["total"] or 0

    return {
        "active_mentors": active.count(),
        "total_sessions": total,
        "total_hours": round(total_minutes / 60, 1),
        "xp_earned": xp,
        "skills_learned": skills,
        "sessions_this_month": sessions_this_month,
    }


def get_program_stats() -> dict[str, Any]:
    """Platform-wide mentorship program statistics."""
    from .models import (
        MentorProfile,
        MentorshipMatch,
        MentorshipRequest,
        MentorshipSession,
    )

    profiles = MentorProfile.objects.filter(is_active=True)
    matches = MentorshipMatch.objects.all()
    sessions = MentorshipSession.objects.filter(status="completed")
    requests = MentorshipRequest.objects.all()

    return {
        "total_mentors": profiles.count(),
        "available_mentors": profiles.filter(
            availability="available"
        ).count(),
        "verified_mentors": profiles.filter(is_verified=True).count(),
        "total_matches": matches.count(),
        "active_matches": matches.filter(status="active").count(),
        "total_sessions": sessions.count(),
        "total_hours": round(
            sessions.aggregate(t=Sum("duration_minutes"))["t"] or 0
            / 60, 1
        ),
        "total_requests": requests.count(),
        "accepted_requests": requests.filter(status="accepted").count(),
        "pending_requests": requests.filter(status="pending").count(),
        "average_session_rating": round(
            sessions.aggregate(a=Avg("mentor_rating"))["a"] or 0, 1
        ),
        "top_skills": list(
            MentorProfile.objects.values_list(
                "expertise_areas", flat=True
            )
        ),
    }


# ---------------------------------------------------------------------------
#  Recommendations
# ---------------------------------------------------------------------------

def get_session_recommendations(match) -> list[str]:
    """Generate session topic recommendations based on match history."""
    sessions = match.sessions.filter(status="completed")
    all_topics = []
    for s in sessions.values_list("topics_covered", flat=True):
        all_topics.extend(s or [])

    topic_counts = defaultdict(int)
    for t in all_topics:
        topic_counts[t] += 1

    # Suggest topics not yet covered
    focus = match.skill_focus or ""
    suggestions = [
        f"Review {focus} fundamentals",
        f"Work on a {focus} project together",
        f"Practice {focus} debugging techniques",
        f"Explore advanced {focus} patterns",
        f"Pair-program on a real {focus} task",
    ]

    # Add topic-specific suggestions from covered topics
    if topic_counts:
        most_common = max(topic_counts, key=topic_counts.get)
        suggestions.append(
            f"Deep-dive into {most_common} (most discussed topic)"
        )

    return suggestions[:5]
