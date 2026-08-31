"""
Django admin for the Study Groups app.
"""

from django.contrib import admin

from .models import (
    GroupActivity,
    GroupChallenge,
    GroupChallengeParticipant,
    GroupGoal,
    GroupInvite,
    GroupMembership,
    GroupMessage,
    GroupResource,
    StudyGroup,
)


@admin.register(StudyGroup)
class StudyGroupAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "name",
        "owner",
        "visibility",
        "category",
        "member_count",
        "total_xp",
        "streak_days",
        "is_archived",
    ]
    list_filter = ["visibility", "category", "is_archived"]
    search_fields = ["name", "owner__username"]
    prepopulated_fields = {"slug": ("name",)}
    raw_id_fields = ["owner"]


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "group",
        "role",
        "status",
        "total_xp_contributed",
        "lessons_completed",
        "joined_at",
    ]
    list_filter = ["role", "status"]
    search_fields = ["user__username", "group__name"]
    raw_id_fields = ["user", "group"]


@admin.register(GroupInvite)
class GroupInviteAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "invited_by",
        "invited_user",
        "email",
        "status",
        "created_at",
    ]
    list_filter = ["status"]
    search_fields = ["email", "group__name"]
    raw_id_fields = ["group", "invited_by", "invited_user"]


@admin.register(GroupResource)
class GroupResourceAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "resource_type",
        "title",
        "shared_by",
        "upvotes",
    ]
    list_filter = ["resource_type"]
    search_fields = ["title", "group__name"]
    raw_id_fields = ["group", "shared_by", "flashcard_deck"]


@admin.register(GroupActivity)
class GroupActivityAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "user",
        "activity_type",
        "title",
        "xp_value",
        "created_at",
    ]
    list_filter = ["activity_type"]
    search_fields = ["user__username", "group__name"]
    raw_id_fields = ["group", "user"]


@admin.register(GroupChallenge)
class GroupChallengeAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "title",
        "status",
        "target_type",
        "target_value",
        "start_date",
        "end_date",
    ]
    list_filter = ["status"]
    search_fields = ["title", "group__name"]
    raw_id_fields = ["group", "created_by"]


@admin.register(GroupChallengeParticipant)
class GroupChallengeParticipantAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "challenge",
        "user",
        "current_value",
        "completed",
        "xp_earned",
    ]
    raw_id_fields = ["challenge", "user"]


@admin.register(GroupGoal)
class GroupGoalAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "title",
        "goal_type",
        "target_value",
        "current_value",
        "is_completed",
    ]
    list_filter = ["goal_type", "is_completed"]
    search_fields = ["title", "group__name"]
    raw_id_fields = ["group"]


@admin.register(GroupMessage)
class GroupMessageAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "group",
        "user",
        "content",
        "is_pinned",
        "upvotes",
        "created_at",
    ]
    list_filter = ["is_pinned"]
    search_fields = ["user__username", "group__name", "content"]
    raw_id_fields = ["group", "user", "parent"]
