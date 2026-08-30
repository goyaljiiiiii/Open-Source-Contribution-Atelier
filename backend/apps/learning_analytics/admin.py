"""
Django admin configuration for the Learning Analytics app.
"""

from django.contrib import admin

from .models import (
    DailyLearningMetric,
    LearningGoal,
    LearningInsight,
    LearningSession,
    SessionSkillTag,
    SkillTag,
    UserSkillProfile,
)


@admin.register(SkillTag)
class SkillTagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "icon_emoji", "parent"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(LearningSession)
class LearningSessionAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "activity_type",
        "duration_seconds",
        "xp_earned",
        "score",
        "completed",
        "started_at",
    ]
    list_filter = ["activity_type", "completed"]
    search_fields = ["user__username"]
    raw_id_fields = ["user"]
    readonly_fields = ["started_at"]


@admin.register(SessionSkillTag)
class SessionSkillTagAdmin(admin.ModelAdmin):
    list_display = ["session", "skill_tag", "confidence"]
    raw_id_fields = ["session", "skill_tag"]


@admin.register(UserSkillProfile)
class UserSkillProfileAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "skill_tag",
        "level",
        "total_sessions",
        "average_score",
        "trend",
        "last_practiced",
    ]
    list_filter = ["trend"]
    search_fields = ["user__username", "skill_tag__name"]
    raw_id_fields = ["user", "skill_tag"]


@admin.register(LearningInsight)
class LearningInsightAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "insight_type",
        "title",
        "priority",
        "is_read",
        "is_dismissed",
        "generated_at",
    ]
    list_filter = ["insight_type", "priority", "is_read", "is_dismissed"]
    search_fields = ["user__username", "title"]
    raw_id_fields = ["user"]


@admin.register(DailyLearningMetric)
class DailyLearningMetricAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "date",
        "total_minutes",
        "lessons_completed",
        "quizzes_taken",
        "average_quiz_score",
        "xp_earned",
        "streak_days",
        "focus_score",
    ]
    list_filter = ["date"]
    search_fields = ["user__username"]
    raw_id_fields = ["user"]


@admin.register(LearningGoal)
class LearningGoalAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "title",
        "goal_type",
        "target_value",
        "current_value",
        "is_completed",
        "is_archived",
        "deadline",
    ]
    list_filter = ["goal_type", "is_completed", "is_archived"]
    search_fields = ["user__username", "title"]
    raw_id_fields = ["user", "skill_tag"]
