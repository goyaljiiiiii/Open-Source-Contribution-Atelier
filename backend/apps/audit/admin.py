from django.contrib import admin

from apps.audit.models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "actor",
        "resource_type",
        "resource_id",
        "correlation_id",
        "ip_address",
        "created_at",
    )
    list_filter = ("action", "resource_type", "created_at")
    search_fields = (
        "actor__username",
        "resource_id",
        "correlation_id",
        "ip_address",
        "user_agent",
    )
    readonly_fields = (
        "actor",
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
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from apps.audit.models import RBAC

User = get_user_model()


class TargetUserFilter(admin.SimpleListFilter):
    title = _("target user")
    parameter_name = "target_user"

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request).filter(resource_type="User")
        user_ids = set(qs.values_list("resource_id", flat=True)[:100])
        users = User.objects.filter(id__in=list(user_ids)).values_list("id", "username")
        return [(str(uid), username) for uid, username in users]

    def has_output(self):
        return True

    def queryset(self, request, queryset):
        val = self.value()
        if val:
            return queryset.filter(resource_type="User", resource_id=val)
        return queryset


class PermissionFilter(admin.SimpleListFilter):
    title = _("permission")
    parameter_name = "permission"

    def lookups(self, request, model_admin):
        # We can extract recent permissions from events, but it's complex.
        # Alternatively, we could just return a few common ones or let it be 
        # used via URL. For simplicity, we fetch distinct slugs from DB.
        from apps.rbac.models import Permission
        perms = Permission.objects.values_list("slug", flat=True)[:50]
        return [(p, p) for p in perms]

    def has_output(self):
        return True

    def queryset(self, request, queryset):
        val = self.value()
        if val:
            if "." in val:
                app, code = val.split(".", 1)
            else:
                app, code = "rbac", val
            return queryset.filter(after__contains=[[app, code]]) | queryset.filter(before__contains=[[app, code]])
        return queryset


@admin.register(RBAC)
class RBACAdmin(admin.ModelAdmin):
    list_display = (
        "action",
        "actor",
        "target_user",
        "created_at",
    )
    # The requirement asks for filters: actor, target user, permission, date range
    list_filter = ("actor", TargetUserFilter, PermissionFilter, "created_at")
    search_fields = (
        "actor__username",
        "resource_id",
        "correlation_id",
        "before",
        "after",
    )
    readonly_fields = (
        "actor",
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
    )

    def get_queryset(self, request):
        # Only show RBAC events
        qs = super().get_queryset(request)
        return qs.filter(extra__has_key="rbac")

    def target_user(self, obj):
        if obj.resource_type == "User":
            try:
                return User.objects.get(id=obj.resource_id)
            except User.DoesNotExist:
                return obj.resource_id
        return None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
