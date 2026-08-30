"""
URL patterns for the Learning Analytics & Insights app.
"""

from django.urls import path

from .views import (
    AnalyticsDashboardView,
    DailyMetricsListView,
    GoalPredictionView,
    InsightBulkReadView,
    InsightDismissView,
    InsightRefreshView,
    LearningGoalDetailView,
    LearningGoalListCreateView,
    LearningInsightListView,
    LearningSessionDetailView,
    LearningSessionListCreateView,
    MonthlyRecapView,
    SkillLevelRefreshView,
    SkillTagListView,
    UserSkillProfileListView,
    VelocityView,
    WeeklySummaryView,
)

app_name = "learning_analytics"

urlpatterns = [
    # ── Sessions ──────────────────────────────────────────────────────────
    path(
        "sessions/",
        LearningSessionListCreateView.as_view(),
        name="session-list",
    ),
    path(
        "sessions/<int:pk>/",
        LearningSessionDetailView.as_view(),
        name="session-detail",
    ),
    # ── Skills ────────────────────────────────────────────────────────────
    path(
        "skills/",
        SkillTagListView.as_view(),
        name="skill-tag-list",
    ),
    path(
        "skills/profiles/",
        UserSkillProfileListView.as_view(),
        name="skill-profile-list",
    ),
    path(
        "skills/refresh/",
        SkillLevelRefreshView.as_view(),
        name="skill-level-refresh",
    ),
    # ── Insights ──────────────────────────────────────────────────────────
    path(
        "insights/",
        LearningInsightListView.as_view(),
        name="insight-list",
    ),
    path(
        "insights/refresh/",
        InsightRefreshView.as_view(),
        name="insight-refresh",
    ),
    path(
        "insights/dismiss/",
        InsightDismissView.as_view(),
        name="insight-dismiss",
    ),
    path(
        "insights/bulk-read/",
        InsightBulkReadView.as_view(),
        name="insight-bulk-read",
    ),
    # ── Dashboard & Metrics ───────────────────────────────────────────────
    path(
        "dashboard/",
        AnalyticsDashboardView.as_view(),
        name="analytics-dashboard",
    ),
    path(
        "daily-metrics/",
        DailyMetricsListView.as_view(),
        name="daily-metrics",
    ),
    path(
        "velocity/",
        VelocityView.as_view(),
        name="velocity",
    ),
    # ── Summaries ─────────────────────────────────────────────────────────
    path(
        "weekly-summary/",
        WeeklySummaryView.as_view(),
        name="weekly-summary",
    ),
    path(
        "monthly-recap/",
        MonthlyRecapView.as_view(),
        name="monthly-recap",
    ),
    # ── Goals ─────────────────────────────────────────────────────────────
    path(
        "goals/",
        LearningGoalListCreateView.as_view(),
        name="goal-list",
    ),
    path(
        "goals/<int:pk>/",
        LearningGoalDetailView.as_view(),
        name="goal-detail",
    ),
    path(
        "goals/<int:goal_id>/predict/",
        GoalPredictionView.as_view(),
        name="goal-prediction",
    ),
]
