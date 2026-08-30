"""
Django admin for the Flashcards app.
"""

from django.contrib import admin

from .models import (
    Deck,
    DeckShare,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)


@admin.register(Deck)
class DeckAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "title",
        "user",
        "deck_type",
        "card_count",
        "clone_count",
        "is_public",
        "updated_at",
    ]
    list_filter = ["deck_type", "is_public"]
    search_fields = ["title", "user__username"]
    raw_id_fields = ["user", "source_lesson"]


@admin.register(Flashcard)
class FlashcardAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "deck",
        "front",
        "difficulty",
        "order",
        "is_suspended",
    ]
    list_filter = ["difficulty", "is_suspended"]
    search_fields = ["front", "back"]
    raw_id_fields = ["deck"]


@admin.register(ReviewSchedule)
class ReviewScheduleAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "flashcard",
        "easiness_factor",
        "interval_days",
        "repetition",
        "next_review",
        "total_reviews",
        "streak",
        "is_new",
    ]
    list_filter = ["is_new"]
    search_fields = ["user__username"]
    raw_id_fields = ["user", "flashcard"]


@admin.register(ReviewLog)
class ReviewLogAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "flashcard",
        "rating",
        "prev_easiness",
        "new_easiness",
        "response_time_ms",
        "reviewed_at",
    ]
    list_filter = ["rating"]
    search_fields = ["user__username"]
    raw_id_fields = ["user", "flashcard", "schedule"]


@admin.register(DeckShare)
class DeckShareAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "source_deck",
        "cloned_by",
        "created_at",
    ]
    raw_id_fields = ["source_deck", "cloned_by", "cloned_deck"]


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "deck",
        "session_type",
        "cards_reviewed",
        "cards_correct",
        "duration_seconds",
        "xp_earned",
        "started_at",
    ]
    list_filter = ["session_type"]
    search_fields = ["user__username"]
    raw_id_fields = ["user", "deck"]
