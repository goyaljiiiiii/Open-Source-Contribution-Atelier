"""
Learning Journal services.

Handles streak computation, weekly reflection generation, mood/productivity
analytics, and journal statistics.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, F, Sum
from django.utils import timezone

User = get_user_model()


def compute_journal_streak(user, up_to=None) -> dict[str, Any]:
    """Compute the user's journaling streak up to a given date.

    Returns dict with current_streak, longest_streak, total_entries.
    """
    from .models import JournalEntry, UserReflectionStreak

    if up_to is None:
        up_to = timezone.now().date()

    dates = set(
        JournalEntry.objects.filter(user=user)
        .values_list("date", flat=True)
    )

    # Current streak: walk backwards from up_to
    current = 0
    d = up_to
    while d in dates:
        current += 1
        d -= timedelta(days=1)

    # Longest streak: sort all dates and find longest consecutive run
    sorted_dates = sorted(dates)
    longest = 0
    run = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run, current)

    # Update or create streak profile
    streak, _ = UserReflectionStreak.objects.get_or_create(user=user)
    streak.current_streak = current
    streak.longest_streak = max(streak.longest_streak, longest)
    streak.last_entry_date = sorted_dates[-1] if sorted_dates else None
    streak.save(update_fields=[
        "current_streak", "longest_streak",
        "last_entry_date", "updated_at",
    ])

    return {
        "current_streak": current,
        "longest_streak": streak.longest_streak,
        "total_entries": len(dates),
    }


def generate_weekly_summary(user, week_start=None) -> dict[str, Any]:
    """Generate a weekly reflection summary for the user."""
    from .models import JournalEntry, WeeklyReflection

    if week_start is None:
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)

    entries = JournalEntry.objects.filter(
        user=user,
        date__gte=week_start,
        date__lte=week_end,
    ).order_by("date")

    count = entries.count()
    if count == 0:
        return {
            "week_start": week_start.isoformat(),
            "entries_count": 0,
            "summary": "No entries this week. Start writing today!",
        }

    agg = entries.aggregate(
        total_words=Sum("word_count"),
        total_hours=Sum("hours_spent"),
        avg_mood=Avg("mood"),
        avg_prod=Avg("productivity_score"),
    )

    # Mood trend (first half vs second half)
    mid = week_start + timedelta(days=3)
    first_half = entries.filter(date__lt=mid).aggregate(
        avg=Avg("mood")
    )["avg"]
    second_half = entries.filter(date__gte=mid).aggregate(
        avg=Avg("mood")
    )["avg"]

    if first_half and second_half:
        diff = second_half - first_half
        if diff > 0.5:
            mood_trend = "improving"
        elif diff < -0.5:
            mood_trend = "declining"
        else:
            mood_trend = "stable"
    else:
        mood_trend = "stable"

    # Top tags
    all_tags = []
    for t in entries.values_list("tags", flat=True):
        all_tags.extend(t or [])
    top_tags = [
        {"tag": tag, "count": c}
        for tag, c in Counter(all_tags).most_common(5)
    ]

    # Highlights: entries with highest mood or most words
    highlights = []
    best_entries = entries.order_by("-mood", "-word_count")[:3]
    for e in best_entries:
        highlights.append({
            "date": e.date.isoformat(),
            "mood": e.mood,
            "words": e.word_count,
            "snippet": e.what_i_learned[:200],
        })

    # Build summary text
    summary_parts = [
        f"You wrote {count} journal {'entry' if count == 1 else 'entries'} "
        f"this week totaling {agg['total_words'] or 0} words "
        f"across {agg['total_hours'] or 0:.1f} hours of learning.",
    ]
    if agg["avg_mood"]:
        mood_label = _mood_label(agg["avg_mood"])
        summary_parts.append(
            f"Your average mood was {mood_label} "
            f"(trend: {mood_trend})."
        )
    if agg["avg_prod"]:
        summary_parts.append(
            f"Average productivity: {agg['avg_prod']:.1f}/10."
        )
    if top_tags:
        tag_names = [t["tag"] for t in top_tags[:3]]
        summary_parts.append(f"Focus areas: {', '.join(tag_names)}.")

    summary = " ".join(summary_parts)

    # Create or update the weekly reflection
    reflection, _ = WeeklyReflection.objects.update_or_create(
        user=user,
        week_start=week_start,
        defaults={
            "summary": summary,
            "entries_count": count,
            "total_words": agg["total_words"] or 0,
            "total_hours": round(agg["total_hours"] or 0, 1),
            "average_mood": round(agg["avg_mood"] or 0, 1),
            "average_productivity": round(agg["avg_prod"] or 0, 1),
            "mood_trend": mood_trend,
            "top_tags": top_tags,
            "highlights": highlights,
        },
    )

    return {
        "week_start": week_start.isoformat(),
        "summary": summary,
        "entries_count": count,
        "total_words": agg["total_words"] or 0,
        "total_hours": round(agg["total_hours"] or 0, 1),
        "average_mood": round(agg["avg_mood"] or 0, 1),
        "mood_trend": mood_trend,
        "top_tags": top_tags,
        "highlights": highlights,
    }


def _mood_label(avg_mood: float) -> str:
    if avg_mood >= 4.5:
        return "Great"
    if avg_mood >= 3.5:
        return "Good"
    if avg_mood >= 2.5:
        return "Okay"
    if avg_mood >= 1.5:
        return "Bad"
    return "Terrible"


def get_journal_stats(user) -> dict[str, Any]:
    """Get comprehensive journal statistics for the user."""
    from .models import JournalEntry

    entries = JournalEntry.objects.filter(user=user)
    total = entries.count()

    if total == 0:
        return {
            "total_entries": 0,
            "total_words": 0,
            "total_hours": 0,
            "average_mood": 0,
            "average_productivity": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "favorite_tag": None,
            "entries_this_week": 0,
            "entries_this_month": 0,
            "mood_distribution": {},
            "productivity_trend": [],
            "busiest_day": None,
            "most_productive_hour": None,
        }

    agg = entries.aggregate(
        words=Sum("word_count"),
        hours=Sum("hours_spent"),
        avg_mood=Avg("mood"),
        avg_prod=Avg("productivity_score"),
    )

    now = timezone.now()
    week_start = (now - timedelta(days=now.weekday())).date()
    month_start = now.replace(day=1).date()

    entries_this_week = entries.filter(date__gte=week_start).count()
    entries_this_month = entries.filter(date__gte=month_start).count()

    # Mood distribution
    mood_dist = dict(
        entries.values("mood").annotate(count=Count("id")).values_list(
            "mood", "count"
        )
    )

    # Top tags
    all_tags = []
    for t in entries.values_list("tags", flat=True):
        all_tags.extend(t or [])
    favorite_tag = Counter(all_tags).most_common(1)[0][0] if all_tags else None

    # Productivity trend (last 30 days)
    thirty_days_ago = (now - timedelta(days=30)).date()
    trend_data = list(
        entries.filter(date__gte=thirty_days_ago)
        .values("date")
        .annotate(avg_prod=Avg("productivity_score"))
        .order_by("date")
        .values_list("date", "avg_prod")
    )

    # Busiest day of week
    from django.db.models.functions import ExtractWeekDay
    day_counts = (
        entries.annotate(day_of_week=ExtractWeekDay("date"))
        .values("day_of_week")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    busiest = day_counts.first()
    day_names = {
        1: "Sunday", 2: "Monday", 3: "Tuesday",
        4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday",
    }
    busiest_day = day_names.get(busiest["day_of_week"]) if busiest else None

    return {
        "total_entries": total,
        "total_words": agg["words"] or 0,
        "total_hours": round(agg["hours"] or 0, 1),
        "average_mood": round(agg["avg_mood"] or 0, 1),
        "average_productivity": round(agg["avg_prod"] or 0, 1),
        "favorite_tag": favorite_tag,
        "entries_this_week": entries_this_week,
        "entries_this_month": entries_this_month,
        "mood_distribution": {
            _mood_label(k): v for k, v in mood_dist.items()
        },
        "productivity_trend": [
            {"date": d.isoformat(), "productivity": round(p or 0, 1)}
            for d, p in trend_data
        ],
        "busiest_day": busiest_day,
    }


def get_social_feed(user, limit=20) -> list[dict[str, Any]]:
    """Get public journal entries from users the given user follows."""
    from .models import JournalEntry

    entries = JournalEntry.objects.filter(
        visibility="public",
    ).exclude(
        user=user,
    ).select_related("user").order_by("-date")[:limit]

    return [
        {
            "id": e.id,
            "username": e.user.username,
            "date": e.date.isoformat(),
            "title": e.title,
            "what_i_learned": e.what_i_learned[:300],
            "mood": e.mood,
            "mood_label": _mood_label(e.mood),
            "tags": e.tags,
            "hours_spent": e.hours_spent,
            "reactions_count": e.reactions.count(),
            "comments_count": e.comments.count(),
        }
        for e in entries
    ]


def get_reflection_prompt(user=None) -> dict[str, Any]:
    """Get a reflection prompt for the user."""
    from .models import ReflectionPrompt

    today = timezone.now().date()
    day_of_week = today.weekday()

    # Rotate through prompts based on day
    prompts = ReflectionPrompt.objects.filter(is_active=True)
    count = prompts.count()
    if count == 0:
        return {
            "text": "What did you learn today that surprised you?",
            "type": "daily",
        }

    idx = day_of_week % count
    prompt = prompts[idx]
    prompt.times_used = F("times_used") + 1
    prompt.save(update_fields=["times_used"])

    return {
        "id": prompt.id,
        "text": prompt.text,
        "type": prompt.prompt_type,
        "category": prompt.category,
    }
