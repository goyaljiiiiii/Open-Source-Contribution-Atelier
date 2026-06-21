from django.urls import path

from apps.dashboard.views import AdminDashboardView, ContributorDashboardView, PublicLandingStatsView

app_name = "dashboard"

urlpatterns = [
    path("admin/", AdminDashboardView.as_view(), name="admin_stats"),
    path("contributor/", ContributorDashboardView.as_view(), name="contributor_stats"),
    path("stats-public/", PublicLandingStatsView.as_view(), name="public_stats"),
]