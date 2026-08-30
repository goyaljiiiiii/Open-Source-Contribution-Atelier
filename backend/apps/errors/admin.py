from django.contrib import admin
from django.utils import timezone

from apps.errors.models import ErrorEvent, ErrorGroup


@admin.register(ErrorGroup)
class ErrorGroupAdmin(admin.ModelAdmin):
    list_display = (
        "module",
        "exception_class",
        "message_preview",
        "count",
        "status",
        "first_seen",
        "last_seen",
    )
    list_filter = ("status", "module", "exception_class", "last_seen")
    search_fields = ("message", "fingerprint", "exception_class")
    ordering = ("-count",)
    actions = ["mark_acknowledged", "mark_resolved"]

    def message_preview(self, obj):
        return obj.message[:80] + ("..." if len(obj.message) > 80 else "")

    message_preview.short_description = "Message"

    @admin.action(description="Mark selected groups as Acknowledged")
    def mark_acknowledged(self, request, queryset):
        queryset.update(status="acknowledged", resolved_at=None)
        self.message_user(request, "Selected groups marked as Acknowledged.")

    @admin.action(description="Mark selected groups as Resolved")
    def mark_resolved(self, request, queryset):
        queryset.update(status="resolved", resolved_at=timezone.now())
        self.message_user(request, "Selected groups marked as Resolved.")


@admin.register(ErrorEvent)
class ErrorEventAdmin(admin.ModelAdmin):
    list_display = (
        "group",
        "exception_class",
        "raw_message_preview",
        "request_id",
        "user_id",
        "timestamp",
    )
    list_filter = ("timestamp", "exception_class", "group__module")
    search_fields = ("raw_message", "exception_class", "request_id", "user_id")
    readonly_fields = (
        "group",
        "raw_message",
        "exception_class",
        "stacktrace",
        "request_id",
        "user_id",
        "timestamp",
        "metadata",
    )

    def raw_message_preview(self, obj):
        return obj.raw_message[:80] + ("..." if len(obj.raw_message) > 80 else "")

    raw_message_preview.short_description = "Raw Message"
