"""Django admin for the Learning Journal app."""

from django.contrib import admin

from .models import (
    JournalComment,
    JournalEntry,
    JournalReaction,
    JournalTemplate,
    ReflectionPrompt,
    UserReflectionStreak,
    WeeklyReflection,
)


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = [
        "id", "user", "date", "title", "mood",
        "productivity_score", "word_count", "xp_earned",
    ]
    list_filter = ["mood", "visibility"]
    search_fields = ["user__username", "title", "what_i_learned"]
    raw_id_fields = ["user"]


@admin.register(JournalComment)
class JournalCommentAdmin(admin.ModelAdmin):
    list_display = [
        "id", "entry", "user", "is_mentor_note", "created_at",
    ]
    raw_id_fields = ["entry", "user"]


@admin.register(JournalReaction)
class JournalReactionAdmin(admin.ModelAdmin):
    list_display = ["id", "entry", "user", "reaction_type", "created_at"]
    list_filter = ["reaction_type"]
    raw_id_fields = ["entry", "user"]


@admin.register(ReflectionPrompt)
class ReflectionPromptAdmin(admin.ModelAdmin):
    list_display = [
        "id", "text", "prompt_type", "category",
        "is_active", "times_used",
    ]
    list_filter = ["prompt_type", "is_active"]


@admin.register(UserReflectionStreak)
class UserReflectionStreakAdmin(admin.ModelAdmin):
    list_display = [
        "user", "current_streak", "longest_streak",
        "total_entries", "total_words_written",
    ]
    raw_id_fields = ["user"]


@admin.register(WeeklyReflection)
class WeeklyReflectionAdmin(admin.ModelAdmin):
    list_display = [
        "user", "week_start", "entries_count",
        "mood_trend", "total_words", "is_read",
    ]
    list_filter = ["mood_trend", "is_read"]
    raw_id_fields = ["user"]


@admin.register(JournalTemplate)
class JournalTemplateAdmin(admin.ModelAdmin):
    list_display = [
        "name", "created_by", "is_public",
        "clone_count", "created_at",
    ]
    list_filter = ["is_public"]
    raw_id_fields = ["created_by"]
