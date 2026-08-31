"""
Learning Analytics utility helpers.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Q
from django.utils import timezone


def get_current_streak(user, up_to: date | None = None) -> int:
    """Return the number of consecutive days up to *up_to* that the user
    had at least one learning session.

    Defaults to today if *up_to* is not provided.
    """
    from .models import DailyLearningMetric

    if up_to is None:
        up_to = timezone.now().date()

    streak = 0
    current_date = up_to

    # Walk backwards from *up_to*
    while True:
        has_activity = DailyLearningMetric.objects.filter(
            user=user,
            date=current_date,
            total_minutes__gt=0,
        ).exists()

        if not has_activity:
            break

        streak += 1
        current_date -= timedelta(days=1)

        # Safety valve: cap at 365
        if streak >= 365:
            break

    return streak


def compute_velocity(user, days: int = 7) -> dict[str, float]:
    """Compute the user's learning velocity over the last *days* days.

    Returns dict with:
    - minutes_per_day: average daily learning minutes
    - xp_per_day: average daily XP earned
    - sessions_per_day: average daily session count
    """
    from .models import DailyLearningMetric

    start = (timezone.now() - timedelta(days=days)).date()
    metrics = DailyLearningMetric.objects.filter(
        user=user,
        date__gte=start,
    )

    total_days = max(days, 1)
    total_minutes = sum(m.total_minutes for m in metrics)
    total_xp = sum(m.xp_earned for m in metrics)
    total_sessions = sum(
        m.lessons_completed + m.exercises_completed + m.quizzes_taken for m in metrics
    )

    return {
        "minutes_per_day": round(total_minutes / total_days, 1),
        "xp_per_day": round(total_xp / total_days, 1),
        "sessions_per_day": round(total_sessions / total_days, 1),
    }


def predict_completion(user, goal) -> dict:
    """Predict when the user will reach their learning goal.

    Uses linear regression on recent daily progress to estimate
    the completion date.
    """
    from datetime import datetime

    from .models import DailyLearningMetric

    if goal.is_completed:
        return {
            "estimated_date": goal.start_date.isoformat(),
            "confidence": "completed",
        }

    velocity = compute_velocity(user, days=14)
    remaining = goal.target_value - goal.current_value

    if remaining <= 0:
        return {
            "estimated_date": timezone.now().date().isoformat(),
            "confidence": "immediate",
        }

    # Compute progress velocity based on goal type
    if goal.goal_type == "xp_target":
        progress_per_day = velocity["xp_per_day"]
    elif goal.goal_type == "lesson_count":
        start = timezone.now() - timedelta(days=14)
        from .models import LearningSession

        lessons_completed = LearningSession.objects.filter(
            user=user,
            activity_type="lesson",
            completed=True,
            started_at__gte=start,
        ).count()
        progress_per_day = lessons_completed / 14
    elif goal.goal_type == "streak_target":
        progress_per_day = 1  # One streak day per day
    else:
        progress_per_day = velocity["sessions_per_day"]

    if progress_per_day <= 0:
        return {
            "estimated_date": None,
            "confidence": "unknown",
            "reason": "No recent activity to base prediction on.",
        }

    days_remaining = remaining / progress_per_day
    estimated_date = timezone.now().date() + timedelta(days=int(days_remaining))

    # Confidence based on amount of data
    from .models import DailyLearningMetric

    active_days_count = DailyLearningMetric.objects.filter(
        user=user,
        date__gte=(timezone.now() - timedelta(days=14)).date(),
        total_minutes__gt=0,
    ).count()

    if active_days_count >= 10:
        confidence = "high"
    elif active_days_count >= 5:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "estimated_date": estimated_date.isoformat(),
        "days_remaining": int(days_remaining),
        "progress_per_day": round(progress_per_day, 1),
        "confidence": confidence,
    }
