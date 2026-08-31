"""Django admin for the Mentorship app."""

from django.contrib import admin

from .models import (
    MentorProfile,
    MentorshipFeedback,
    MentorshipGoal,
    MentorshipMatch,
    MentorshipMilestone,
    MentorshipRequest,
    MentorshipSession,
)


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "availability",
        "average_rating",
        "total_sessions_mentored",
        "current_mentee_count",
        "is_verified",
        "is_active",
    ]
    list_filter = ["availability", "is_verified", "is_active"]
    search_fields = ["user__username", "bio"]
    raw_id_fields = ["user"]


@admin.register(MentorshipRequest)
class MentorshipRequestAdmin(admin.ModelAdmin):
    list_display = [
        "mentee",
        "mentor",
        "subject",
        "status",
        "skill_wanted",
        "created_at",
    ]
    list_filter = ["status", "preferred_frequency"]
    search_fields = ["mentee__username", "mentor__username", "subject"]
    raw_id_fields = ["mentee", "mentor"]


@admin.register(MentorshipMatch)
class MentorshipMatchAdmin(admin.ModelAdmin):
    list_display = [
        "mentor",
        "mentee",
        "skill_focus",
        "status",
        "total_sessions",
        "total_hours",
        "created_at",
    ]
    list_filter = ["status"]
    search_fields = ["mentor__username", "mentee__username"]
    raw_id_fields = ["mentor", "mentee", "request"]


@admin.register(MentorshipSession)
class MentorshipSessionAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "mentor",
        "mentee",
        "status",
        "scheduled_at",
        "duration_minutes",
        "mentor_rating",
        "xp_awarded_mentor",
    ]
    list_filter = ["status"]
    search_fields = [
        "title",
        "mentor__username",
        "mentee__username",
    ]
    raw_id_fields = ["match", "mentor", "mentee"]


@admin.register(MentorshipGoal)
class MentorshipGoalAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "match",
        "status",
        "progress_pct",
        "target_date",
        "achieved_date",
    ]
    list_filter = ["status"]
    search_fields = ["title"]
    raw_id_fields = ["match", "created_by"]


@admin.register(MentorshipFeedback)
class MentorshipFeedbackAdmin(admin.ModelAdmin):
    list_display = [
        "from_user",
        "to_user",
        "feedback_type",
        "overall_rating",
        "communication_rating",
        "helpfulness_rating",
        "is_anonymous",
        "created_at",
    ]
    list_filter = ["feedback_type", "is_anonymous"]
    raw_id_fields = ["match", "from_user", "to_user"]


@admin.register(MentorshipMilestone)
class MentorshipMilestoneAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "match",
        "user",
        "xp_awarded",
        "achieved_at",
    ]
    search_fields = ["title", "user__username"]
    raw_id_fields = ["match", "user"]
