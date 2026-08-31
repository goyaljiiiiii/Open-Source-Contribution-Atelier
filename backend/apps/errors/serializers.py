from rest_framework import serializers

from apps.errors.models import ErrorEvent, ErrorGroup


class ErrorEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorEvent
        fields = (
            "id",
            "group",
            "raw_message",
            "exception_class",
            "stacktrace",
            "request_id",
            "user_id",
            "timestamp",
            "metadata",
        )


class ErrorGroupSerializer(serializers.ModelSerializer):
    events_count = serializers.IntegerField(source="events.count", read_only=True)

    class Meta:
        model = ErrorGroup
        fields = (
            "id",
            "fingerprint",
            "message",
            "module",
            "exception_class",
            "count",
            "first_seen",
            "last_seen",
            "status",
            "resolved_at",
            "cooldown_days",
            "events_count",
        )
