"""
Admin configuration for feature flags with A/B testing and advanced management.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.contrib import messages

from .models import FeatureFlag, Experiment, FeatureFlagAuditLog


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    """
    Advanced admin interface for FeatureFlag model.
    """
    
    # ============================================================
    # List Display Configuration
    # ============================================================
    
    list_display = (
        "name",
        "enabled_badge",
        "status_badge",
        "strategy_badge",
        "target_percentage",
        "exposure_count",
        "conversion_rate",
        "description_short",
        "created_at",
    )
    
    list_filter = (
        "enabled",
        "status",
        "strategy",
        "created_at",
    )
    
    search_fields = (
        "name",
        "description",
        "targeting_rules",
    )
    
    list_per_page = 50
    list_select_related = True
    date_hierarchy = "created_at"
    
    # ============================================================
    # Field Configuration
    # ============================================================
    
    fieldsets = (
        ("Basic Information", {
            "fields": (
                "name",
                "description",
                "enabled",
                "status",
            ),
            "classes": ("wide",),
        }),
        ("Configuration", {
            "fields": (
                "strategy",
                "value",
                "variants",
            ),
            "classes": ("wide",),
        }),
        ("Targeting", {
            "fields": (
                "target_users",
                "target_roles",
                "target_percentage",
                "targeting_rules",
            ),
            "classes": ("wide",),
            "description": "Configure who should see this feature flag.",
        }),
        ("Analytics", {
            "fields": (
                "exposure_count",
                "enabled_count",
                "conversion_count",
                "stats_display",
            ),
            "classes": ("collapse", "wide"),
            "description": "Analytics and usage statistics for this flag.",
        }),
        ("Timestamps", {
            "fields": (
                "created_at",
                "updated_at",
                "activated_at",
                "deactivated_at",
            ),
            "classes": ("collapse",),
        }),
    )
    
    readonly_fields = (
        "exposure_count",
        "enabled_count",
        "conversion_count",
        "stats_display",
        "created_at",
        "updated_at",
        "activated_at",
        "deactivated_at",
    )
    
    # ============================================================
    # Inline Models
    # ============================================================
    
    inlines = [
        # We'll add ExperimentInline later
    ]
    
    # ============================================================
    # Actions
    # ============================================================
    
    actions = [
        "enable_flags",
        "disable_flags",
        "activate_flags",
        "deactivate_flags",
        "archive_flags",
        "reset_analytics",
        "duplicate_flags",
    ]
    
    @admin.action(description="✅ Enable selected flags")
    def enable_flags(self, request, queryset):
        """Enable selected flags."""
        count = 0
        for flag in queryset:
            flag.enabled = True
            flag.save()
            count += 1
        self.message_user(request, f"✅ Enabled {count} flags.", messages.SUCCESS)
    
    @admin.action(description="❌ Disable selected flags")
    def disable_flags(self, request, queryset):
        """Disable selected flags."""
        count = 0
        for flag in queryset:
            flag.enabled = False
            flag.save()
            count += 1
        self.message_user(request, f"❌ Disabled {count} flags.", messages.WARNING)
    
    @admin.action(description="🚀 Activate selected flags")
    def activate_flags(self, request, queryset):
        """Activate selected flags."""
        count = 0
        for flag in queryset:
            flag.activate(request.user)
            count += 1
        self.message_user(request, f"🚀 Activated {count} flags.", messages.SUCCESS)
    
    @admin.action(description="⏹ Deactivate selected flags")
    def deactivate_flags(self, request, queryset):
        """Deactivate selected flags."""
        count = 0
        for flag in queryset:
            flag.deactivate(request.user)
            count += 1
        self.message_user(request, f"⏹ Deactivated {count} flags.", messages.WARNING)
    
    @admin.action(description="📦 Archive selected flags")
    def archive_flags(self, request, queryset):
        """Archive selected flags."""
        count = 0
        for flag in queryset:
            flag.archive(request.user)
            count += 1
        self.message_user(request, f"📦 Archived {count} flags.", messages.INFO)
    
    @admin.action(description="🔄 Reset analytics for selected flags")
    def reset_analytics(self, request, queryset):
        """Reset analytics counts for selected flags."""
        count = 0
        for flag in queryset:
            flag.exposure_count = 0
            flag.enabled_count = 0
            flag.conversion_count = 0
            flag.save()
            count += 1
        self.message_user(
            request, 
            f"🔄 Reset analytics for {count} flags.", 
            messages.INFO
        )
    
    @admin.action(description="📋 Duplicate selected flags")
    def duplicate_flags(self, request, queryset):
        """Duplicate selected flags with new names."""
        count = 0
        for flag in queryset:
            # Create duplicate
            new_flag = FeatureFlag.objects.create(
                name=f"{flag.name}_copy_{timezone.now().timestamp()}",
                description=f"Copy of {flag.name} - {flag.description}",
                enabled=False,
                strategy=flag.strategy,
                status=FeatureFlag.STATUS_DRAFT,
                value=flag.value,
                variants=flag.variants,
                target_percentage=flag.target_percentage,
                target_roles=flag.target_roles,
                targeting_rules=flag.targeting_rules,
            )
            # Copy many-to-many relationships
            new_flag.target_users.set(flag.target_users.all())
            count += 1
        self.message_user(
            request, 
            f"📋 Duplicated {count} flags (draft mode).", 
            messages.SUCCESS
        )
    
    # ============================================================
    # Custom Display Methods
    # ============================================================
    
    def enabled_badge(self, obj):
        """Display enabled status as a badge."""
        if obj.enabled:
            return format_html(
                '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">✅ Active</span>'
            )
        return format_html(
            '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">❌ Inactive</span>'
        )
    enabled_badge.short_description = "Status"
    
    def status_badge(self, obj):
        """Display status as a color-coded badge."""
        colors = {
            FeatureFlag.STATUS_DRAFT: '#6c757d',
            FeatureFlag.STATUS_ACTIVE: '#28a745',
            FeatureFlag.STATUS_INACTIVE: '#dc3545',
            FeatureFlag.STATUS_ARCHIVED: '#6c757d',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background: {0}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">{1}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = "Lifecycle"
    
    def strategy_badge(self, obj):
        """Display strategy as a badge."""
        strategies = {
            FeatureFlag.STRATEGY_BOOLEAN: '⚪ Boolean',
            FeatureFlag.STRATEGY_PERCENTAGE: '📊 Percentage',
            FeatureFlag.STRATEGY_USER_WHITELIST: '✅ Whitelist',
            FeatureFlag.STRATEGY_USER_BLACKLIST: '🚫 Blacklist',
            FeatureFlag.STRATEGY_ROLE: '👤 Role',
            FeatureFlag.STRATEGY_CUSTOM: '⚙️ Custom',
        }
        return strategies.get(obj.strategy, obj.strategy)
    strategy_badge.short_description = "Strategy"
    
    def conversion_rate(self, obj):
        """Display conversion rate."""
        if obj.exposure_count > 0:
            rate = (obj.conversion_count / obj.exposure_count) * 100
            color = '#28a745' if rate > 50 else '#ffc107' if rate > 20 else '#dc3545'
            return format_html(
                '<span style="color: {0}; font-weight: bold;">{1:.1f}%</span>',
                color,
                rate
            )
        return format_html('<span style="color: #6c757d;">—</span>')
    conversion_rate.short_description = "Conversion Rate"
    
    def description_short(self, obj):
        """Truncate description."""
        if len(obj.description) > 50:
            return obj.description[:50] + "..."
        return obj.description
    description_short.short_description = "Description"
    
    def stats_display(self, obj):
        """Display analytics statistics."""
        if obj.exposure_count == 0:
            return "No data yet"
        
        return format_html(
            """
            <div style="font-family: monospace;">
                <strong>📊 Analytics</strong><br>
                👁️ Exposures: <strong>{}</strong><br>
                ✅ Enabled: <strong>{}</strong><br>
                🎯 Conversions: <strong>{}</strong><br>
                📈 Rate: <strong>{:.1f}%</strong>
            </div>
            """,
            obj.exposure_count,
            obj.enabled_count,
            obj.conversion_count,
            (obj.conversion_count / obj.exposure_count * 100) if obj.exposure_count > 0 else 0
        )
    stats_display.short_description = "Statistics"
    
    # ============================================================
    # Save Methods
    # ============================================================
    
    def save_model(self, request, obj, form, change):
        """Save model with audit logging."""
        if not change:
            # Creating new flag
            obj.save()
            FeatureFlagAuditLog.objects.create(
                feature_flag=obj,
                user=request.user,
                action='create',
                changes={'name': obj.name, 'enabled': obj.enabled},
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
            self.message_user(
                request, 
                f"✅ Feature flag '{obj.name}' created successfully.", 
                messages.SUCCESS
            )
        else:
            # Updating existing flag
            old_obj = FeatureFlag.objects.get(pk=obj.pk)
            changes = {}
            for field in ['name', 'enabled', 'strategy', 'status', 'value', 'target_percentage']:
                if getattr(old_obj, field) != getattr(obj, field):
                    changes[field] = {
                        'old': getattr(old_obj, field),
                        'new': getattr(obj, field)
                    }
            
            obj.save()
            
            if changes:
                FeatureFlagAuditLog.objects.create(
                    feature_flag=obj,
                    user=request.user,
                    action='update',
                    changes=changes,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT', '')
                )
                self.message_user(
                    request, 
                    f"✅ Feature flag '{obj.name}' updated successfully.", 
                    messages.SUCCESS
                )
    
    def delete_model(self, request, obj):
        """Delete model with audit logging."""
        name = obj.name
        obj.delete()
        self.message_user(
            request, 
            f"🗑️ Feature flag '{name}' deleted.", 
            messages.WARNING
        )
    
    def delete_queryset(self, request, queryset):
        """Delete multiple models with audit logging."""
        count = queryset.count()
        names = list(queryset.values_list('name', flat=True))
        queryset.delete()
        self.message_user(
            request, 
            f"🗑️ Deleted {count} flags: {', '.join(names[:5])}" + 
            (f" and {count - 5} more..." if count > 5 else ""),
            messages.WARNING
        )
    
    # ============================================================
    # Custom Actions
    # ============================================================
    
    def get_actions(self, request):
        """Customize actions based on user permissions."""
        actions = super().get_actions(request)
        if not request.user.is_superuser:
            # Remove destructive actions for non-superusers
            actions.pop('archive_flags', None)
            actions.pop('delete_selected', None)
        return actions


@admin.register(Experiment)
class ExperimentAdmin(admin.ModelAdmin):
    """
    Admin interface for Experiment model.
    """
    
    list_display = (
        'name',
        'feature_flag',
        'status_badge',
        'total_users',
        'variants_count',
        'started_at',
    )
    
    list_filter = (
        'status',
        'feature_flag',
        'created_at',
    )
    
    search_fields = (
        'name',
        'description',
        'feature_flag__name',
    )
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'feature_flag', 'status')
        }),
        ('Variants', {
            'fields': ('variants', 'control_variant', 'allocation_percentage')
        }),
        ('Metrics', {
            'fields': ('success_metric', 'secondary_metrics')
        }),
        ('Analytics', {
            'fields': ('total_users', 'conversions', 'results_display')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'started_at', 'completed_at')
        }),
    )
    
    readonly_fields = (
        'total_users',
        'conversions',
        'results_display',
        'created_at',
        'updated_at',
    )
    
    actions = [
        'start_experiments',
        'pause_experiments',
        'complete_experiments',
        'reset_experiments',
    ]
    
    def status_badge(self, obj):
        """Display status as a color-coded badge."""
        colors = {
            Experiment.STATUS_DRAFT: '#6c757d',
            Experiment.STATUS_RUNNING: '#28a745',
            Experiment.STATUS_PAUSED: '#ffc107',
            Experiment.STATUS_COMPLETED: '#17a2b8',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background: {0}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">{1}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = "Status"
    
    def variants_count(self, obj):
        """Count variants."""
        return len(obj.variants)
    variants_count.short_description = "Variants"
    
    def results_display(self, obj):
        """Display experiment results."""
        if obj.status != Experiment.STATUS_COMPLETED:
            return "Experiment not completed"
        
        results = obj.get_results()
        if not results or 'variants' not in results:
            return "No results available"
        
        html = '<div style="font-family: monospace; font-size: 12px;">'
        html += f'<strong>📊 Results for {obj.name}</strong><br>'
        html += f'Total Users: {obj.total_users}<br>'
        html += f'Total Conversions: {sum(obj.conversions.values()) if obj.conversions else 0}<br><br>'
        
        for variant_name, data in results['variants'].items():
            winner = '🏆 ' if data.get('is_winner') else ''
            control = '(Control) ' if data.get('is_control') else ''
            html += f'{winner}{variant_name} {control}<br>'
            html += f'  Conversions: {data["conversions"]}<br>'
            html += f'  Rate: {data["conversion_rate"]}%<br>'
            html += '<br>'
        
        html += '</div>'
        return format_html(html)
    results_display.short_description = "Results"
    
    @admin.action(description="▶️ Start selected experiments")
    def start_experiments(self, request, queryset):
        """Start selected experiments."""
        count = 0
        for experiment in queryset:
            experiment.start()
            count += 1
        self.message_user(request, f"▶️ Started {count} experiments.", messages.SUCCESS)
    
    @admin.action(description="⏸ Pause selected experiments")
    def pause_experiments(self, request, queryset):
        """Pause selected experiments."""
        count = 0
        for experiment in queryset:
            experiment.pause()
            count += 1
        self.message_user(request, f"⏸ Paused {count} experiments.", messages.WARNING)
    
    @admin.action(description="⏹ Complete selected experiments")
    def complete_experiments(self, request, queryset):
        """Complete selected experiments."""
        count = 0
        for experiment in queryset:
            experiment.complete()
            count += 1
        self.message_user(request, f"⏹ Completed {count} experiments.", messages.SUCCESS)
    
    @admin.action(description="🔄 Reset selected experiments")
    def reset_experiments(self, request, queryset):
        """Reset selected experiments."""
        count = 0
        for experiment in queryset:
            experiment.total_users = 0
            experiment.conversions = {}
            experiment.save()
            count += 1
        self.message_user(request, f"🔄 Reset {count} experiments.", messages.INFO)


@admin.register(FeatureFlagAuditLog)
class FeatureFlagAuditLogAdmin(admin.ModelAdmin):
    """
    Admin interface for FeatureFlagAuditLog model.
    """
    
    list_display = (
        'feature_flag',
        'user',
        'action_badge',
        'timestamp',
        'ip_address',
    )
    
    list_filter = (
        'action',
        'timestamp',
        'feature_flag',
    )
    
    search_fields = (
        'feature_flag__name',
        'user__username',
        'changes',
    )
    
    readonly_fields = (
        'feature_flag',
        'user',
        'action',
        'changes',
        'ip_address',
        'user_agent',
        'timestamp',
    )
    
    fieldsets = (
        ('Audit Entry', {
            'fields': ('feature_flag', 'user', 'action', 'changes')
        }),
        ('Metadata', {
            'fields': ('ip_address', 'user_agent', 'timestamp')
        }),
    )
    
    def action_badge(self, obj):
        """Display action as a badge."""
        colors = {
            'create': '#28a745',
            'update': '#ffc107',
            'activate': '#17a2b8',
            'deactivate': '#dc3545',
            'archive': '#6c757d',
            'experiment_start': '#28a745',
            'experiment_pause': '#ffc107',
            'experiment_complete': '#17a2b8',
        }
        color = colors.get(obj.action, '#6c757d')
        return format_html(
            '<span style="background: {0}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">{1}</span>',
            color,
            obj.get_action_display()
        )
    action_badge.short_description = "Action"
    
    def has_add_permission(self, request):
        """Prevent manual creation of audit logs."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent editing of audit logs."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of audit logs."""
        return False


# ============================================================
# Dashboard Widgets
# ============================================================

class FeatureFlagDashboard(admin.ModelAdmin):
    """
    Dashboard view for feature flag statistics.
    """
    
    def get_urls(self):
        """Add custom URLs."""
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.dashboard_view, name='feature_flags_dashboard'),
        ]
        return custom_urls + urls
    
    def dashboard_view(self, request):
        """Render dashboard view."""
        from django.shortcuts import render
        
        # Collect statistics
        total_flags = FeatureFlag.objects.count()
        active_flags = FeatureFlag.objects.filter(enabled=True).count()
        inactive_flags = FeatureFlag.objects.filter(enabled=False).count()
        draft_flags = FeatureFlag.objects.filter(status=FeatureFlag.STATUS_DRAFT).count()
        archived_flags = FeatureFlag.objects.filter(status=FeatureFlag.STATUS_ARCHIVED).count()
        
        running_experiments = Experiment.objects.filter(status=Experiment.STATUS_RUNNING).count()
        
        total_exposures = FeatureFlag.objects.aggregate(total=Sum('exposure_count'))['total'] or 0
        total_conversions = FeatureFlag.objects.aggregate(total=Sum('conversion_count'))['total'] or 0
        
        # Top flags by exposure
        top_flags = FeatureFlag.objects.order_by('-exposure_count')[:10]
        
        context = {
            'total_flags': total_flags,
            'active_flags': active_flags,
            'inactive_flags': inactive_flags,
            'draft_flags': draft_flags,
            'archived_flags': archived_flags,
            'running_experiments': running_experiments,
            'total_exposures': total_exposures,
            'total_conversions': total_conversions,
            'top_flags': top_flags,
            'conversion_rate': (total_conversions / total_exposures * 100) if total_exposures > 0 else 0,
        }
        
        return render(request, 'admin/feature_flags/dashboard.html', context)


# ============================================================
# Register FeatureFlagDashboard as admin site view
# ============================================================

# Uncomment to add dashboard to admin
# admin.site.register_view('feature-flags/dashboard/', FeatureFlagDashboard.dashboard_view)