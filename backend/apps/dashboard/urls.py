from django.urls import path

from apps.dashboard.views import (
    AdminDashboardView,
    AnalyticsExportCSVView,
    ContributorDashboardView,
    ModeratorAnalyticsView,
    PublicLandingStatsView,
    UsageAnalyticsView,
)

app_name = "dashboard"

urlpatterns = [
    path("admin/", AdminDashboardView.as_view(), name="admin_stats"),
    path("contributor/", ContributorDashboardView.as_view(), name="contributor_stats"),
    path("stats-public/", PublicLandingStatsView.as_view(), name="public_stats"),
    path("analytics/", ModeratorAnalyticsView.as_view(), name="moderator_analytics"),
    path("analytics/export/", AnalyticsExportCSVView.as_view(), name="analytics_export_csv"),
    path("usage-analytics/", UsageAnalyticsView.as_view(), name="usage_analytics"),
]
