"""
Learning Path Recommendation Engine.

Generates personalised, adaptive learning paths based on a user's skill
profiles, learning velocity, goals, and recent activity patterns.

The engine works in three phases:
  1. **Analyse** — inspect the user's skill gaps, velocity, and goals.
  2. **Plan**    — rank candidate skills and select ordered steps.
  3. **Persist** — create LearningPath / LearningPathStep objects.
"""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

User = get_user_model()

# ---------------------------------------------------------------------------
# Tuning constants
# ---------------------------------------------------------------------------

# How aggressively to fill skill gaps vs reinforcing strengths
_GAP_BONUS = 1.35  # multiply priority when filling a gap
_RECENCY_DECAY_HALF_LIFE = 14  # days before recency score halves
_VELOCITY_WEIGHT = 0.25
_SKILL_GAP_WEIGHT = 0.35
_GOAL_ALIGNMENT_WEIGHT = 0.25
_TREND_WEIGHT = 0.15

MAX_STEPS_PER_PATH = 12
MAX_ACTIVE_PATHS = 5
MIN_PATH_PRIORITY = 10.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@transaction.atomic
def generate_learning_paths(user, force: bool = False) -> list[dict[str, Any]]:
    """Analyse a user and create/update personalised learning paths.

    Returns a list of dicts describing each path created or updated.
    """
    from .models import (
        LearningPath,
        LearningPathStep,
        SkillTag,
        UserSkillProfile,
    )

    now = timezone.now()

    # Phase 1 — Analyse
    profile = _analyse_user(user, now)

    # Phase 2 — Plan
    planned = _plan_paths(user, profile, now)

    # Phase 3 — Persist
    created: list[dict[str, Any]] = []

    # Deactivate old stale paths if over limit
    active_paths = LearningPath.objects.filter(
        user=user,
        status__in=[
            LearningPath.PathStatus.ACTIVE,
            LearningPath.PathStatus.PAUSED,
        ],
    )
    if active_paths.count() >= MAX_ACTIVE_PATHS and not force:
        # Archive the oldest low-priority active path
        oldest = active_paths.order_by("priority_score", "generated_at").first()
        if oldest:
            oldest.status = LearningPath.PathStatus.ARCHIVED
            oldest.save(update_fields=["status", "updated_at"])

    for plan in planned:
        path = _persist_path(user, plan, now)
        created.append(
            {
                "path_id": path.id,
                "title": path.title,
                "priority_score": path.priority_score,
                "total_steps": path.total_steps,
                "difficulty": path.difficulty,
            }
        )

    # Phase 4 — Update progress snapshot
    _update_progress_snapshot(user, now)

    return created


def get_path_recommendations(user) -> list[dict[str, Any]]:
    """Return lightweight recommendations for all active paths."""
    from .models import LearningPath, LearningPathStep

    paths = LearningPath.objects.filter(
        user=user,
        status=LearningPath.PathStatus.ACTIVE,
    ).order_by("-priority_score")[:10]

    results = []
    for path in paths:
        next_step = (
            path.steps.filter(status="not_started").order_by("step_number").first()
        )
        results.append(
            {
                "path_id": path.id,
                "title": path.title,
                "description": path.description,
                "difficulty": path.difficulty,
                "priority_score": path.priority_score,
                "progress_pct": path.progress_pct,
                "total_steps": path.total_steps,
                "completed_steps": path.completed_steps,
                "estimated_minutes": path.estimated_minutes,
                "xp_reward": path.xp_reward,
                "next_step": (
                    {
                        "step_id": next_step.id,
                        "title": next_step.title,
                        "step_type": next_step.step_type,
                        "estimated_minutes": next_step.estimated_minutes,
                    }
                    if next_step
                    else None
                ),
            }
        )

    return results


def compute_path_completion_estimate(user) -> dict[str, Any]:
    """Estimate when the user will finish all active paths."""
    from .models import LearningPath, UserPathProgress

    velocity = _get_daily_velocity(user)
    active_paths = LearningPath.objects.filter(
        user=user,
        status=LearningPath.PathStatus.ACTIVE,
    )

    total_remaining_steps = 0
    for path in active_paths:
        remaining = path.total_steps - path.completed_steps
        total_remaining_steps += max(0, remaining)

    avg_minutes_per_step = 15  # default estimate
    if velocity > 0:
        avg_minutes_per_step = 60 / velocity  # minutes per step

    estimated_days = (
        math.ceil(total_remaining_steps * avg_minutes_per_step / 30)
        if total_remaining_steps > 0
        else 0
    )

    return {
        "active_path_count": active_paths.count(),
        "total_remaining_steps": total_remaining_steps,
        "daily_step_velocity": round(velocity, 2),
        "estimated_completion_days": estimated_days,
        "estimated_date": (
            (timezone.now() + timedelta(days=estimated_days)).date().isoformat()
            if estimated_days > 0
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Phase 1: Analyse user
# ---------------------------------------------------------------------------


def _analyse_user(user, now: timezone.datetime) -> dict[str, Any]:
    """Build an analysis profile for the user."""
    from .models import (
        LearningSession,
        SkillTag,
        UserSkillProfile,
    )

    # Skill levels
    skill_profiles = list(
        UserSkillProfile.objects.filter(user=user).select_related("skill_tag")
    )

    skill_levels = {}
    weak_skills: list[dict] = []
    strong_skills: list[dict] = []
    declining_skills: list[dict] = []

    for sp in skill_profiles:
        tag_name = sp.skill_tag.name
        skill_levels[tag_name] = sp.level
        if sp.level < 30:
            weak_skills.append(
                {
                    "tag": sp.skill_tag,
                    "level": sp.level,
                    "trend": sp.trend,
                }
            )
        elif sp.level >= 60:
            strong_skills.append(
                {
                    "tag": sp.skill_tag,
                    "level": sp.level,
                    "trend": sp.trend,
                }
            )
        if sp.trend == "declining":
            declining_skills.append(
                {
                    "tag": sp.skill_tag,
                    "level": sp.level,
                }
            )

    # Recent sessions (last 14 days)
    two_weeks_ago = now - timedelta(days=14)
    recent_sessions = LearningSession.objects.filter(
        user=user,
        started_at__gte=two_weeks_ago,
    )

    activity_counts = defaultdict(int)
    total_minutes = 0
    for s in recent_sessions:
        activity_counts[s.activity_type] += 1
        total_minutes += s.duration_seconds // 60

    avg_quiz_score = recent_sessions.filter(
        activity_type="quiz", score__isnull=False
    ).aggregate(avg=Sum("score"))

    # Active goals
    from .models import LearningGoal

    active_goals = LearningGoal.objects.filter(
        user=user,
        is_completed=False,
        is_archived=False,
    )

    goal_skill_slugs = set()
    for g in active_goals:
        if g.skill_tag:
            goal_skill_slugs.add(g.skill_tag.slug)

    return {
        "skill_levels": skill_levels,
        "weak_skills": weak_skills,
        "strong_skills": strong_skills,
        "declining_skills": declining_skills,
        "activity_counts": dict(activity_counts),
        "total_recent_minutes": total_minutes,
        "avg_quiz_score": avg_quiz_score["avg"] or 0,
        "active_goals": list(active_goals),
        "goal_skill_slugs": goal_skill_slugs,
    }


# ---------------------------------------------------------------------------
# Phase 2: Plan paths
# ---------------------------------------------------------------------------


def _plan_paths(
    user, profile: dict[str, Any], now: timezone.datetime
) -> list[dict[str, Any]]:
    """Create path plans based on the analysis."""
    from .models import SkillTag

    plans: list[dict[str, Any]] = []

    # Strategy 1: Fill critical skill gaps
    if profile["weak_skills"]:
        gap_plan = _plan_skill_gap_path(user, profile, now)
        if gap_plan:
            plans.append(gap_plan)

    # Strategy 2: Reverse declining skills
    if profile["declining_skills"]:
        recovery_plan = _plan_recovery_path(user, profile, now)
        if recovery_plan:
            plans.append(recovery_plan)

    # Strategy 3: Goal-aligned path
    if profile["active_goals"]:
        goal_plan = _plan_goal_path(user, profile, now)
        if goal_plan:
            plans.append(goal_plan)

    # Strategy 4: Skill diversification (if user only does 1 activity type)
    diversity_plan = _plan_diversity_path(user, profile, now)
    if diversity_plan:
        plans.append(diversity_plan)

    # Strategy 5: Challenge path for strong skills
    if profile["strong_skills"]:
        challenge_plan = _plan_challenge_path(user, profile, now)
        if challenge_plan:
            plans.append(challenge_plan)

    return plans


def _plan_skill_gap_path(
    user, profile: dict, now: timezone.datetime
) -> dict[str, Any] | None:
    """Build a path to close the user's weakest skill areas."""
    if not profile["weak_skills"]:
        return None

    weak = sorted(profile["weak_skills"], key=lambda s: s["level"])[:3]
    steps = []
    for i, skill in enumerate(weak):
        estimated_mins = max(10, 30 - skill["level"] // 3)
        steps.append(
            {
                "step_number": i + 1,
                "title": f"Build {skill['tag'].name} fundamentals",
                "description": (
                    f"Your {skill['tag'].name} level is {skill['level']}/100. "
                    f"Regular practice will close this gap."
                ),
                "step_type": "exercise",
                "activity_type": "exercise",
                "skill_tag": skill["tag"],
                "estimated_minutes": estimated_mins,
                "xp_reward": 20 + skill["level"],
                "is_milestone": i == len(weak) - 1,
                "reasoning": (
                    f"Skill gap detected: {skill['tag'].name} at level "
                    f"{skill['level']}/100"
                ),
            }
        )

    total_minutes = sum(s["estimated_minutes"] for s in steps)
    priority = _compute_priority(profile, "gap", weak)

    return {
        "title": "Skill Gap Recovery",
        "description": (
            "Strengthen your weakest skill areas to build a solid foundation."
        ),
        "difficulty": "beginner",
        "target_skills": [s["tag"] for s in weak],
        "estimated_minutes": total_minutes,
        "priority_score": priority,
        "steps": steps,
        "metadata": {
            "strategy": "skill_gap",
            "target_skills": [s["tag"].slug for s in weak],
        },
    }


def _plan_recovery_path(
    user, profile: dict, now: timezone.datetime
) -> dict[str, Any] | None:
    """Build a path to reverse declining skills."""
    if not profile["declining_skills"]:
        return None

    declining = profile["declining_skills"][:2]
    steps = []
    for i, skill in enumerate(declining):
        steps.append(
            {
                "step_number": i + 1,
                "title": f"Revisit {skill['tag'].name} review",
                "description": (
                    f"Your {skill['tag'].name} skill is declining. "
                    f"Consistent review will reverse the trend."
                ),
                "step_type": "review",
                "activity_type": "lesson",
                "skill_tag": skill["tag"],
                "estimated_minutes": 20,
                "xp_reward": 25,
                "is_milestone": i == len(declining) - 1,
                "reasoning": (
                    f"Declining skill detected: {skill['tag'].name} "
                    f"(level {skill['level']}/100, trend: declining)"
                ),
            }
        )

    priority = _compute_priority(profile, "recovery", declining)

    return {
        "title": "Skill Maintenance & Recovery",
        "description": ("Reverse declining skills with targeted review sessions."),
        "difficulty": "intermediate",
        "target_skills": [s["tag"] for s in declining],
        "estimated_minutes": sum(s["estimated_minutes"] for s in steps),
        "priority_score": priority,
        "steps": steps,
        "metadata": {
            "strategy": "recovery",
            "target_skills": [s["tag"].slug for s in declining],
        },
    }


def _plan_goal_path(
    user, profile: dict, now: timezone.datetime
) -> dict[str, Any] | None:
    """Build a path aligned with the user's active goals."""
    goals = profile["active_goals"]
    if not goals:
        return None

    steps = []
    for i, goal in enumerate(goals[:3]):
        tag = goal.skill_tag
        step_type = "challenge" if goal.goal_type == "xp_target" else "lesson"
        steps.append(
            {
                "step_number": i + 1,
                "title": f"Push towards: {goal.title}",
                "description": (
                    f"Goal progress: {goal.current_value}/{goal.target_value} "
                    f"({goal.progress_pct}%). Keep going!"
                ),
                "step_type": step_type,
                "activity_type": "challenge" if step_type == "challenge" else "lesson",
                "skill_tag": tag,
                "estimated_minutes": 25,
                "xp_reward": 30,
                "is_milestone": i == len(goals) - 1,
                "reasoning": (
                    f"Active goal: {goal.title} — " f"{goal.progress_pct}% complete"
                ),
            }
        )

    total_minutes = sum(s["estimated_minutes"] for s in steps)
    priority = 50 + max(g.progress_pct for g in goals) / 2

    return {
        "title": "Goal Sprint",
        "description": ("A focused sprint to make progress on your active goals."),
        "difficulty": "intermediate",
        "target_skills": [g.skill_tag for g in goals if g.skill_tag],
        "estimated_minutes": total_minutes,
        "priority_score": min(priority, 95),
        "steps": steps,
        "metadata": {
            "strategy": "goal_alignment",
            "goal_ids": [g.id for g in goals],
        },
    }


def _plan_diversity_path(
    user, profile: dict, now: timezone.datetime
) -> dict[str, Any] | None:
    """Encourage trying different activity types."""
    counts = profile["activity_counts"]
    if len(counts) >= 3 or sum(counts.values()) < 5:
        return None

    missing_types = [
        t
        for t in ["lesson", "exercise", "quiz", "sandbox", "peer_review"]
        if counts.get(t, 0) == 0
    ]

    if not missing_types:
        return None

    steps = []
    type_labels = {
        "lesson": "📖 Read a lesson",
        "exercise": "💻 Complete an exercise",
        "quiz": "📝 Take a quiz",
        "sandbox": "🔧 Use the sandbox",
        "peer_review": "👀 Do a peer review",
    }
    for i, atype in enumerate(missing_types[:3]):
        steps.append(
            {
                "step_number": i + 1,
                "title": type_labels.get(atype, f"Try {atype}"),
                "description": (
                    f"You haven't tried {atype} yet. "
                    f"Diversifying your learning improves retention."
                ),
                "step_type": "exercise",
                "activity_type": atype,
                "skill_tag": None,
                "estimated_minutes": 15,
                "xp_reward": 15,
                "is_milestone": i == len(missing_types) - 1,
                "reasoning": (f"No {atype} activity detected in recent sessions"),
            }
        )

    return {
        "title": "Activity Diversification",
        "description": ("Explore new types of activities to broaden your learning."),
        "difficulty": "beginner",
        "target_skills": [],
        "estimated_minutes": sum(s["estimated_minutes"] for s in steps),
        "priority_score": 30,
        "steps": steps,
        "metadata": {
            "strategy": "diversity",
            "missing_types": missing_types,
        },
    }


def _plan_challenge_path(
    user, profile: dict, now: timezone.datetime
) -> dict[str, Any] | None:
    """Push strong skills further with advanced challenges."""
    strong = sorted(
        profile["strong_skills"],
        key=lambda s: s["level"],
        reverse=True,
    )[:2]

    if not strong or strong[0]["level"] < 60:
        return None

    steps = []
    for i, skill in enumerate(strong):
        steps.append(
            {
                "step_number": i + 1,
                "title": f"Advanced challenge: {skill['tag'].name}",
                "description": (
                    f"You're at level {skill['level']} in {skill['tag'].name}. "
                    f"Time for a harder challenge!"
                ),
                "step_type": "challenge",
                "activity_type": "challenge",
                "skill_tag": skill["tag"],
                "estimated_minutes": 30,
                "xp_reward": 40,
                "is_milestone": i == len(strong) - 1,
                "reasoning": (
                    f"Strong skill — challenge at level {skill['level']}/100"
                ),
            }
        )

    priority = 25 + strong[0]["level"] / 4

    return {
        "title": "Advanced Challenges",
        "description": (
            "Push your strongest skills to mastery with harder challenges."
        ),
        "difficulty": "advanced",
        "target_skills": [s["tag"] for s in strong],
        "estimated_minutes": sum(s["estimated_minutes"] for s in steps),
        "priority_score": min(priority, 80),
        "steps": steps,
        "metadata": {
            "strategy": "challenge",
            "target_skills": [s["tag"].slug for s in strong],
        },
    }


# ---------------------------------------------------------------------------
# Phase 3: Persist
# ---------------------------------------------------------------------------


def _persist_path(user, plan: dict, now: timezone.datetime):
    """Create LearningPath + LearningPathStep records."""
    from .models import LearningPath, LearningPathStep

    path = LearningPath.objects.create(
        user=user,
        title=plan["title"],
        description=plan["description"],
        difficulty=plan["difficulty"],
        estimated_minutes=plan["estimated_minutes"],
        total_steps=len(plan["steps"]),
        priority_score=plan["priority_score"],
        metadata=plan.get("metadata", {}),
    )

    # Attach target skills
    for tag in plan.get("target_skills", []):
        if tag:
            path.target_skills.add(tag)

    # Create steps
    step_objects = []
    for step_data in plan["steps"]:
        step_obj = LearningPathStep(
            path=path,
            step_number=step_data["step_number"],
            title=step_data["title"],
            description=step_data["description"],
            step_type=step_data["step_type"],
            activity_type=step_data.get("activity_type"),
            skill_tag=step_data.get("skill_tag"),
            estimated_minutes=step_data["estimated_minutes"],
            xp_reward=step_data["xp_reward"],
            is_milestone=step_data.get("is_milestone", False),
            reasoning=step_data.get("reasoning", ""),
        )
        step_objects.append(step_obj)

    LearningPathStep.objects.bulk_create(step_objects)

    return path


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _compute_priority(profile: dict, strategy: str, target_skills: list[dict]) -> float:
    """Compute a 0-100 priority score for a path plan."""
    base_score = 50.0

    # Skill gap weight
    avg_level = (
        sum(s["level"] for s in target_skills) / len(target_skills)
        if target_skills
        else 0
    )
    gap_score = max(0, 100 - avg_level) * _SKILL_GAP_WEIGHT

    # Trend bonus
    declining_count = sum(1 for s in target_skills if s.get("trend") == "declining")
    trend_score = declining_count * 15 * _TREND_WEIGHT

    # Velocity factor
    velocity = _get_daily_velocity(profile.get("_user", None))
    velocity_score = min(velocity * 10, 20) * _VELOCITY_WEIGHT

    # Goal alignment bonus
    goal_score = 0
    if strategy == "goal_alignment":
        goal_score = 20 * _GOAL_ALIGNMENT_WEIGHT

    priority = base_score + gap_score + trend_score + velocity_score + goal_score
    return round(min(priority, 99), 1)


def _get_daily_velocity(user) -> float:
    """Average learning sessions per day over last 14 days."""
    if user is None:
        return 0.0
    from .models import UserPathProgress

    two_weeks = timezone.now().date() - timedelta(days=14)
    snapshots = UserPathProgress.objects.filter(user=user, date__gte=two_weeks)
    total_steps = sum(s.steps_completed_today for s in snapshots)
    return total_steps / 14.0


def _update_progress_snapshot(user, now: timezone.datetime):
    """Create or update today's progress snapshot."""
    from .models import LearningPath, UserPathProgress

    today = now.date()
    active_count = LearningPath.objects.filter(
        user=user,
        status__in=[
            LearningPath.PathStatus.ACTIVE,
            LearningPath.PathStatus.PAUSED,
        ],
    ).count()

    # Count steps completed today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    from .models import LearningPathStep

    steps_today = LearningPathStep.objects.filter(
        path__user=user,
        status=LearningPathStep.StepStatus.COMPLETED,
        completed_at__gte=today_start,
    ).count()

    xp_today = (
        LearningPathStep.objects.filter(
            path__user=user,
            status=LearningPathStep.StepStatus.COMPLETED,
            completed_at__gte=today_start,
        ).aggregate(total=Sum("xp_reward"))["total"]
        or 0
    )

    minutes_today = (
        LearningPathStep.objects.filter(
            path__user=user,
            status=LearningPathStep.StepStatus.COMPLETED,
            completed_at__gte=today_start,
        ).aggregate(total=Sum("estimated_minutes"))["total"]
        or 0
    )

    UserPathProgress.objects.update_or_create(
        user=user,
        date=today,
        defaults={
            "active_path_count": active_count,
            "steps_completed_today": steps_today,
            "xp_earned_today": xp_today,
            "total_path_minutes_today": minutes_today,
        },
    )
