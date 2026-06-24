from apps.dashboard.views import (AdminDashboardView, BuyStreakFreezeView,
                                  ContributorDashboardView,
                                  PublicLandingStatsView)
from django.urls import path

app_name = "dashboard"

urlpatterns = [
    path("admin/", AdminDashboardView.as_view(), name="admin_stats"),
    path("contributor/", ContributorDashboardView.as_view(), name="contributor_stats"),
    path("stats-public/", PublicLandingStatsView.as_view(), name="public_stats"),
    path("streak-freeze/buy/", BuyStreakFreezeView.as_view(), name="buy_streak_freeze"),
]
