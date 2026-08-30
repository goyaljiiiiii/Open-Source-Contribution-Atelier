"""
Flashcard Spaced Repetition Engine.

Implements the SM-2 algorithm with modern enhancements:
- Easiness factor tracking with floor of 1.3
- Graduated intervals: 1d → 6d → subsequent intervals
- Lapse handling (rating 0/1 resets repetition)
- Streak bonuses for consecutive correct recalls
- Session XP calculation based on accuracy and streak
"""

from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

User = get_user_model()

# ---------------------------------------------------------------------------
#  SM-2 Algorithm Constants
# ---------------------------------------------------------------------------

_DEFAULT_EF = 2.5
_MIN_EF = 1.3
_MAX_EF = 3.0

# Interval multipliers by quality rating (0-4)
# After first 2 successful reviews, interval = prev_interval * EF multiplier
_RATING_INTERVAL_MULTIPLIERS = {
    0: 0.0,    # Again → lapse
    1: 1.0,    # Hard → same interval
    2: 1.0,    # Good → multiply by EF
    3: 1.3,    # Easy → multiply by EF * 1.3
    4: 1.5,    # Perfect → multiply by EF * 1.5
}

# New-card learning steps (in minutes) before graduation
_LEARNING_STEPS_MINUTES = [1, 10]
_GRADUATION_INTERVAL_DAYS = 1

# XP per review quality
_XP_RATINGS = {
    0: 0,     # Again
    1: 2,     # Hard
    2: 5,     # Good
    3: 8,     # Easy
    4: 12,    # Perfect
}

# Streak bonus: every N consecutive good+ reviews adds bonus XP
_STREAK_BONUS_EVERY = 5
_STREAK_BONUS_XP = 10


# ---------------------------------------------------------------------------
#  Core SM-2 Engine
# ---------------------------------------------------------------------------

def compute_next_review(
    easiness_factor: float,
    interval_days: int,
    repetition: int,
    quality: int,
) -> tuple[float, int, int]:
    """Apply the SM-2 algorithm to compute the next review parameters.

    Args:
        easiness_factor: Current EF (≥ 1.3).
        interval_days:   Current interval in days.
        repetition:      Number of consecutive correct reviews.
        quality:         User rating 0 (again) → 4 (perfect).

    Returns:
        (new_ef, new_interval, new_repetition)
    """
    # 1. Update easiness factor
    new_ef = easiness_factor + (
        0.1
        - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )
    new_ef = max(_MIN_EF, min(_MAX_EF, new_ef))

    # 2. Handle lapse (quality < 2)
    if quality < 2:
        return new_ef, 1, 0

    # 3. Compute new interval
    if repetition == 0:
        new_interval = 1
    elif repetition == 1:
        new_interval = 6
    else:
        multiplier = _RATING_INTERVAL_MULTIPLIERS.get(quality, 1.0)
        new_interval = max(1, int(interval_days * new_ef * multiplier))

    new_repetition = repetition + 1
    return new_ef, new_interval, new_repetition


# ---------------------------------------------------------------------------
#  Review Processing
# ---------------------------------------------------------------------------

def process_review(
    user,
    flashcard_id: int,
    quality: int,
    response_time_ms: int = 0,
) -> dict[str, Any]:
    """Process a single flashcard review.

    Updates the ReviewSchedule, creates a ReviewLog, and returns a summary.
    """
    from .models import Flashcard, ReviewLog, ReviewSchedule

    if quality not in range(5):
        raise ValueError(f"Quality must be 0-4, got {quality}")

    with transaction.atomic():
        schedule = (
            ReviewSchedule.objects.select_for_update()
            .get(user=user, flashcard_id=flashcard_id)
        )

        # Snapshot before
        prev_ef = schedule.easiness_factor
        prev_interval = schedule.interval_days
        prev_repetition = schedule.repetition

        # Compute new SM-2 state
        new_ef, new_interval, new_repetition = compute_next_review(
            easiness_factor=schedule.easiness_factor,
            interval_days=schedule.interval_days,
            repetition=schedule.repetition,
            quality=quality,
        )

        # Determine next review time
        if new_repetition == 0:
            # Lapsed: review again in 10 minutes
            next_review = timezone.now() + timedelta(minutes=10)
        else:
            next_review = timezone.now() + timedelta(days=new_interval)

        # Update schedule
        schedule.easiness_factor = new_ef
        schedule.interval_days = new_interval
        schedule.repetition = new_repetition
        schedule.next_review = next_review
        schedule.last_reviewed = timezone.now()
        schedule.total_reviews += 1
        schedule.is_new = False

        is_correct = quality >= 2
        if is_correct:
            schedule.correct_reviews += 1
            schedule.streak += 1
        else:
            schedule.streak = 0

        schedule.save()

        # Create immutable log entry
        log = ReviewLog.objects.create(
            user=user,
            flashcard_id=flashcard_id,
            schedule=schedule,
            rating=quality,
            prev_easiness=prev_ef,
            prev_interval=prev_interval,
            prev_repetition=prev_repetition,
            new_easiness=new_ef,
            new_interval=new_interval,
            new_repetition=new_repetition,
            response_time_ms=response_time_ms,
        )

        # Compute XP
        xp = _XP_RATINGS.get(quality, 0)
        if schedule.streak > 0 and schedule.streak % _STREAK_BONUS_EVERY == 0:
            xp += _STREAK_BONUS_XP

    return {
        "log_id": log.id,
        "quality": quality,
        "is_correct": is_correct,
        "new_easiness": round(new_ef, 2),
        "new_interval_days": new_interval,
        "next_review": next_review.isoformat(),
        "streak": schedule.streak,
        "maturity": schedule.maturity_label,
        "xp_earned": xp,
    }


# ---------------------------------------------------------------------------
#  Due Card Queries
# ---------------------------------------------------------------------------

def get_due_cards(user, deck_id=None, limit=20) -> list[dict[str, Any]]:
    """Get flashcards due for review, ordered by priority.

    Priority: new cards first, then overdue cards sorted by urgency,
    then learning-step cards.
    """
    from .models import ReviewSchedule

    qs = ReviewSchedule.objects.filter(
        user=user,
        flashcard__is_suspended=False,
        next_review__lte=timezone.now(),
    ).select_related("flashcard", "flashcard__deck")

    if deck_id:
        qs = qs.filter(flashcard__deck_id=deck_id)

    # Sort: new cards first, then by most overdue
    due = []
    new_cards = []
    for sched in qs:
        if sched.is_new:
            new_cards.append(sched)
        else:
            due.append(sched)

    # Sort due cards by overdue amount (most overdue first)
    due.sort(key=lambda s: s.next_review)
    new_cards.sort(key=lambda s: s.created_at)

    # Interleave: take some new, some due
    result = []
    now = timezone.now()
    for sched in new_cards[:limit]:
        result.append(_schedule_to_dict(sched))
    remaining = limit - len(result)
    for sched in due[:remaining]:
        result.append(_schedule_to_dict(sched))

    return result


def get_new_cards(user, deck_id=None, limit=10) -> list[dict[str, Any]]:
    """Get unreviewed (new) flashcards for the user."""
    from .models import ReviewSchedule

    qs = ReviewSchedule.objects.filter(
        user=user,
        is_new=True,
        flashcard__is_suspended=False,
    ).select_related("flashcard", "flashcard__deck")

    if deck_id:
        qs = qs.filter(flashcard__deck_id=deck_id)

    return [_schedule_to_dict(s) for s in qs[:limit]]


def _schedule_to_dict(schedule) -> dict[str, Any]:
    """Convert a ReviewSchedule to a card-facing dict."""
    card = schedule.flashcard
    return {
        "schedule_id": schedule.id,
        "card_id": card.id,
        "front": card.front,
        "back": card.back,
        "hint": card.hint,
        "difficulty": card.difficulty,
        "tags": card.tags,
        "media_url": card.media_url,
        "maturity": schedule.maturity_label,
        "easiness_factor": round(schedule.easiness_factor, 2),
        "interval_days": schedule.interval_days,
        "total_reviews": schedule.total_reviews,
        "accuracy": schedule.accuracy_pct,
        "streak": schedule.streak,
        "is_new": schedule.is_new,
        "next_review": schedule.next_review.isoformat(),
    }


# ---------------------------------------------------------------------------
#  Deck Cloning
# ---------------------------------------------------------------------------

def clone_deck(source_deck, target_user) -> "Deck":
    """Clone a public deck for the target user.

    Copies all cards and creates new review schedules.
    Returns the newly created deck.
    """
    from .models import Deck, DeckShare, Flashcard, ReviewSchedule

    new_deck = Deck.objects.create(
        user=target_user,
        title=f"{source_deck.title} (Clone)",
        description=source_deck.description,
        deck_type="custom",
        color=source_deck.color,
        icon_emoji=source_deck.icon_emoji,
        is_public=False,
    )

    # Clone cards and create initial review schedules
    source_cards = Flashcard.objects.filter(deck=source_deck)
    card_ids = []
    for card in source_cards:
        new_card = Flashcard.objects.create(
            deck=new_deck,
            front=card.front,
            back=card.back,
            hint=card.hint,
            difficulty=card.difficulty,
            tags=card.tags,
            order=card.order,
        )
        card_ids.append(new_card.id)

        # Create a fresh review schedule for the new user
        ReviewSchedule.objects.create(
            user=target_user,
            flashcard=new_card,
            next_review=timezone.now(),
        )

    new_deck.recalculate_card_count()

    # Record the share
    DeckShare.objects.create(
        source_deck=source_deck,
        cloned_by=target_user,
        cloned_deck=new_deck,
    )

    # Increment clone count on source
    Deck.objects.filter(id=source_deck.id).update(
        clone_count=F("clone_count") + 1
    )

    return new_deck


# ---------------------------------------------------------------------------
#  Statistics & Analytics
# ---------------------------------------------------------------------------

def get_deck_stats(user, deck_id) -> dict[str, Any]:
    """Compute statistics for a user's deck."""
    from .models import Flashcard, ReviewSchedule

    schedules = ReviewSchedule.objects.filter(
        user=user,
        flashcard__deck_id=deck_id,
    )

    total = schedules.count()
    if total == 0:
        return {
            "total_cards": 0,
            "new_cards": 0,
            "learning": 0,
            "young": 0,
            "mature": 0,
            "due_now": 0,
            "avg_easiness": 0,
            "avg_accuracy": 0,
            "total_reviews": 0,
        }

    maturity_counts = dict(
        schedules.values_list("maturity_label")
        .annotate(count=Count("id"))
        .values_list("maturity_label", "count")
    )

    due_count = schedules.filter(
        next_review__lte=timezone.now()
    ).count()

    agg = schedules.aggregate(
        avg_ef=Avg("easiness_factor"),
        avg_acc=Avg("accuracy_pct"),
        total_reviews=Sum("total_reviews"),
    )

    return {
        "total_cards": total,
        "new_cards": maturity_counts.get("new", 0),
        "learning": maturity_counts.get("learning", 0),
        "young": maturity_counts.get("young", 0),
        "mature": maturity_counts.get("mature", 0),
        "due_now": due_count,
        "avg_easiness": round(agg["avg_ef"] or 0, 2),
        "avg_accuracy": round(agg["avg_acc"] or 0, 1),
        "total_reviews": agg["total_reviews"] or 0,
    }


def get_user_study_stats(user) -> dict[str, Any]:
    """Aggregate study statistics across all decks."""
    from .models import Deck, ReviewSchedule, StudySession

    deck_count = Deck.objects.filter(user=user).count()
    card_count = ReviewSchedule.objects.filter(user=user).count()
    due_count = ReviewSchedule.objects.filter(
        user=user,
        next_review__lte=timezone.now(),
        flashcard__is_suspended=False,
    ).count()

    session_agg = StudySession.objects.filter(user=user).aggregate(
        total_sessions=Count("id"),
        total_cards_reviewed=Sum("cards_reviewed"),
        total_xp=Sum("xp_earned"),
    )

    # Reviews today
    today = timezone.now().date()
    today_reviews = ReviewSchedule.objects.filter(
        user=user,
        last_reviewed__date=today,
    ).count()

    return {
        "total_decks": deck_count,
        "total_cards": card_count,
        "due_now": due_count,
        "today_reviews": today_reviews,
        "total_sessions": session_agg["total_sessions"] or 0,
        "total_cards_reviewed": (
            session_agg["total_cards_reviewed"] or 0
        ),
        "total_xp": session_agg["total_xp"] or 0,
    }


# ---------------------------------------------------------------------------
#  Session XP Calculation
# ---------------------------------------------------------------------------

def calculate_session_xp(
    correct_count: int,
    total_count: int,
    streak: int,
) -> int:
    """Calculate XP earned for a study session."""
    if total_count == 0:
        return 0

    accuracy = correct_count / total_count
    base_xp = correct_count * 5

    # Accuracy bonus
    if accuracy >= 0.9:
        base_xp = int(base_xp * 1.5)
    elif accuracy >= 0.7:
        base_xp = int(base_xp * 1.2)

    # Streak bonus
    streak_bonus = (streak // _STREAK_BONUS_EVERY) * _STREAK_BONUS_XP

    return base_xp + streak_bonus


# ---------------------------------------------------------------------------
#  Deck Creation Helpers
# ---------------------------------------------------------------------------

def create_deck_from_lesson(user, lesson) -> "Deck":
    """Create a flashcard deck from a Lesson's learning objectives."""
    from .models import Deck, Flashcard, ReviewSchedule

    deck = Deck.objects.create(
        user=user,
        title=f"Flashcards: {lesson.title}",
        description=f"Auto-generated from lesson: {lesson.title}",
        deck_type="lesson",
        source_lesson=lesson,
    )

    # Generate cards from learning objectives
    objectives = lesson.learning_objectives or []
    for i, obj in enumerate(objectives):
        card = Flashcard.objects.create(
            deck=deck,
            front=obj.get("question", obj) if isinstance(obj, dict) else str(obj),
            back=obj.get("answer", "") if isinstance(obj, dict) else "",
            order=i,
            difficulty="medium",
        )
        ReviewSchedule.objects.create(
            user=user,
            flashcard=card,
            next_review=timezone.now(),
        )

    deck.recalculate_card_count()
    return deck


def create_deck_from_skill(user, skill_slug, skill_name: str) -> "Deck":
    """Create an empty deck for a skill area."""
    from .models import Deck

    return Deck.objects.create(
        user=user,
        title=f"Skill: {skill_name}",
        description=f"Flashcards for the {skill_name} skill area.",
        deck_type="skill",
        source_skill_slug=skill_slug,
    )
