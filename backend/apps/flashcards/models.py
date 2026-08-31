"""
Flashcards & Spaced Repetition models.

Implements a flashcard system with SM-2-inspired spaced repetition
scheduling.  Users create decks of flashcards (question ↔ answer) and
review them; the engine computes the next review date based on recall
quality.
"""

from __future__ import annotations

import math

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class Deck(models.Model):
    """A collection of flashcards, optionally linked to a Lesson or SkillTag."""

    class DeckType(models.TextChoices):
        CUSTOM = "custom", "Custom"
        LESSON = "lesson", "Lesson-Based"
        SKILL = "skill", "Skill-Based"
        IMPORTED = "imported", "Imported"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="flashcard_decks",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    deck_type = models.CharField(
        max_length=20,
        choices=DeckType.choices,
        default=DeckType.CUSTOM,
        db_index=True,
    )
    source_lesson = models.ForeignKey(
        "content.Lesson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="flashcard_decks",
    )
    source_skill_slug = models.SlugField(
        blank=True,
        help_text="Skill tag slug this deck is associated with.",
    )
    color = models.CharField(
        max_length=7,
        default="#6366f1",
        help_text="Hex color for UI display.",
    )
    icon_emoji = models.CharField(max_length=10, default="🃏")
    is_public = models.BooleanField(
        default=False,
        help_text="Allow other users to clone this deck.",
    )
    clone_count = models.PositiveIntegerField(default=0)
    card_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(
                fields=["user", "-updated_at"],
                name="idx_deck_user_time",
            ),
            models.Index(
                fields=["is_public", "clone_count"],
                name="idx_deck_public_clone",
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.card_count} cards)"

    def recalculate_card_count(self):
        self.card_count = self.cards.count()
        self.save(update_fields=["card_count", "updated_at"])


class Flashcard(models.Model):
    """A single flashcard with a front (question) and back (answer)."""

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    deck = models.ForeignKey(
        Deck,
        on_delete=models.CASCADE,
        related_name="cards",
    )
    front = models.TextField(
        help_text="Question or prompt on the front of the card.",
    )
    back = models.TextField(
        help_text="Answer or explanation on the back.",
    )
    hint = models.TextField(
        blank=True,
        help_text="Optional hint shown before flipping.",
    )
    difficulty = models.CharField(
        max_length=10,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
    )
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Free-form tags for filtering.",
    )
    media_url = models.URLField(
        blank=True,
        help_text="Optional image/audio URL attached to the card.",
    )
    order = models.PositiveIntegerField(default=0)
    is_suspended = models.BooleanField(
        default=False,
        help_text="Suspended cards are excluded from review sessions.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        indexes = [
            models.Index(
                fields=["deck", "is_suspended"],
                name="idx_fc_deck_suspended",
            ),
        ]

    def __str__(self):
        return f"Card #{self.order} in '{self.deck.title}'"


class ReviewSchedule(models.Model):
    """SM-2 spaced repetition schedule for a single card per user.

    One row per (user, flashcard).  Updated after each review.
    """

    class QualityRating(models.IntegerChoices):
        AGAIN = 0, "Again (Blackout)"
        HARD = 1, "Hard"
        GOOD = 2, "Good"
        EASY = 3, "Easy"
        PERFECT = 4, "Perfect"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_schedules",
    )
    flashcard = models.ForeignKey(
        Flashcard,
        on_delete=models.CASCADE,
        related_name="review_schedules",
    )

    # SM-2 state
    easiness_factor = models.FloatField(
        default=2.5,
        validators=[MinValueValidator(1.3), MaxValueValidator(3.0)],
        help_text="SM-2 easiness factor (EF ≥ 1.3).",
    )
    interval_days = models.PositiveIntegerField(
        default=0,
        help_text="Current interval in days before next review.",
    )
    repetition = models.PositiveIntegerField(
        default=0,
        help_text="Consecutive correct reviews (lapses reset to 0).",
    )

    # Tracking
    next_review = models.DateTimeField(
        db_index=True,
        help_text="When this card is next due for review.",
    )
    last_reviewed = models.DateTimeField(null=True, blank=True)
    total_reviews = models.PositiveIntegerField(default=0)
    correct_reviews = models.PositiveIntegerField(default=0)
    streak = models.PositiveIntegerField(
        default=0,
        help_text="Consecutive 'good' or better ratings.",
    )

    # Bookkeeping
    is_new = models.BooleanField(
        default=True,
        help_text="True until the card has been reviewed at least once.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "flashcard")
        ordering = ["next_review"]
        indexes = [
            models.Index(
                fields=["user", "next_review"],
                name="idx_rs_user_next",
            ),
            models.Index(
                fields=["user", "is_new"],
                name="idx_rs_user_new",
            ),
        ]

    def __str__(self):
        status = "new" if self.is_new else f"EF={self.easiness_factor:.1f}"
        return f"{self.user.username} — card {self.flashcard_id} " f"({status})"

    @property
    def accuracy_pct(self) -> float:
        if self.total_reviews == 0:
            return 0.0
        return round(self.correct_reviews / self.total_reviews * 100, 1)

    @property
    def is_due(self) -> bool:
        return timezone.now() >= self.next_review

    @property
    def maturity_label(self) -> str:
        """Classify the card's maturity in the learning pipeline."""
        if self.is_new:
            return "new"
        if self.interval_days < 1:
            return "learning"
        if self.interval_days < 21:
            return "young"
        return "mature"


class ReviewLog(models.Model):
    """Immutable log of every review action for analytics and undo."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="review_logs",
    )
    flashcard = models.ForeignKey(
        Flashcard,
        on_delete=models.CASCADE,
        related_name="review_logs",
    )
    schedule = models.ForeignKey(
        ReviewSchedule,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    rating = models.IntegerField(
        choices=ReviewSchedule.QualityRating.choices,
    )

    # Snapshot of SM-2 state BEFORE the review
    prev_easiness = models.FloatField()
    prev_interval = models.PositiveIntegerField()
    prev_repetition = models.PositiveIntegerField()

    # Snapshot of SM-2 state AFTER the review
    new_easiness = models.FloatField()
    new_interval = models.PositiveIntegerField()
    new_repetition = models.PositiveIntegerField()

    response_time_ms = models.PositiveIntegerField(
        default=0,
        help_text="Milliseconds the user took to answer.",
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-reviewed_at"]
        indexes = [
            models.Index(
                fields=["user", "-reviewed_at"],
                name="idx_rl_user_time",
            ),
            models.Index(
                fields=["flashcard", "rating"],
                name="idx_rl_card_rating",
            ),
        ]

    def __str__(self):
        return (
            f"Review {self.rating} — card {self.flashcard_id} "
            f"by {self.user.username}"
        )


class DeckShare(models.Model):
    """Tracks when a user clones/forks a public deck."""

    source_deck = models.ForeignKey(
        Deck,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    cloned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cloned_decks",
    )
    cloned_deck = models.ForeignKey(
        Deck,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_share",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("source_deck", "cloned_by")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.cloned_by.username} cloned " f"deck {self.source_deck_id}"


class StudySession(models.Model):
    """Records a single study/review session (multiple card reviews)."""

    class SessionType(models.TextChoices):
        DUE = "due", "Due Reviews"
        LEARN = "learn", "New Cards"
        REVIEW = "review", "Review Session"
        CRAM = "cram", "Cram Mode"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_sessions",
    )
    deck = models.ForeignKey(
        Deck,
        on_delete=models.CASCADE,
        related_name="study_sessions",
        null=True,
        blank=True,
    )
    session_type = models.CharField(
        max_length=10,
        choices=SessionType.choices,
        default=SessionType.DUE,
    )
    cards_reviewed = models.PositiveIntegerField(default=0)
    cards_correct = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    xp_earned = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(
                fields=["user", "-started_at"],
                name="idx_ss_user_time",
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} — {self.session_type} "
            f"({self.cards_reviewed} cards)"
        )

    @property
    def accuracy_pct(self) -> float:
        if self.cards_reviewed == 0:
            return 0.0
        return round(self.cards_correct / self.cards_reviewed * 100, 1)

    def end_session(self, **kwargs):
        self.ended_at = kwargs.get("ended_at") or timezone.now()
        if not self.duration_seconds and self.started_at:
            self.duration_seconds = max(
                0,
                int((self.ended_at - self.started_at).total_seconds()),
            )
        for k, v in kwargs.items():
            setattr(self, k, v)
        self.save()
