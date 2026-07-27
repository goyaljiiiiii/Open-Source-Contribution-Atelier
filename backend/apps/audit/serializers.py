from rest_framework import serializers

from apps.audit.models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "actor",
            "actor_username",
            "action",
            "resource_type",
            "resource_id",
            "before",
            "after",
            "correlation_id",
            "ip_address",
            "user_agent",
            "created_at",
            "extra",
            "summary",
        ]
        read_only_fields = fields

    def get_summary(self, obj: AuditEvent) -> str:
        if obj.extra and isinstance(obj.extra, dict) and "summary" in obj.extra:
            return str(obj.extra["summary"])
        
        resource = obj.resource_type.split(".")[-1].capitalize() if obj.resource_type else "Resource"
        if obj.action == AuditEvent.ACTION_CREATED:
            return f"Created {resource} #{obj.resource_id}"
        elif obj.action == AuditEvent.ACTION_DELETED:
            return f"Deleted {resource} #{obj.resource_id}"
        elif obj.action == AuditEvent.ACTION_UPDATED:
            changed_fields = []
            if isinstance(obj.before, dict) and isinstance(obj.after, dict):
                for k, v in obj.after.items():
                    if k in obj.before and obj.before[k] != v:
                        changed_fields.append(k)
            if changed_fields:
                fields_str = ", ".join(changed_fields[:3])
                if len(changed_fields) > 3:
                    fields_str += f" +{len(changed_fields) - 3} more"
                return f"Updated {resource} #{obj.resource_id} ({fields_str})"
            return f"Updated {resource} #{obj.resource_id}"
        return f"{obj.action.capitalize()} {resource} #{obj.resource_id}"
