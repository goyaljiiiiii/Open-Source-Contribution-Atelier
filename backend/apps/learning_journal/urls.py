"""URL patterns for the Learning Journal app."""

from django.urls import path

from .views import (
    JournalCommentListCreateView,
    JournalEntryDetailView,
    JournalEntryListCreateView,
    JournalReactionView,
    JournalSocialFeedView,
    JournalStatsView,
    JournalStreakView,
    JournalTemplateListCreateView,
    ReflectionPromptView,
    TodayEntryView,
    WeeklyReflectionListView,
    WeeklySummaryView,
)

app_name = "learning_journal"

urlpatterns = [
    # ── Entries ───────────────────────────────────────────────────────────
    path(
        "entries/",
        JournalEntryListCreateView.as_view(),
        name="entry-list",
    ),
    path(
        "entries/today/",
        TodayEntryView.as_view(),
        name="today-entry",
    ),
    path(
        "entries/<int:pk>/",
        JournalEntryDetailView.as_view(),
        name="entry-detail",
    ),
    # ── Comments ──────────────────────────────────────────────────────────
    path(
        "entries/<int:entry_id>/comments/",
        JournalCommentListCreateView.as_view(),
        name="entry-comments",
    ),
    # ── Reactions ─────────────────────────────────────────────────────────
    path(
        "entries/<int:entry_id>/react/",
        JournalReactionView.as_view(),
        name="entry-react",
    ),
    # ── Streak & Stats ────────────────────────────────────────────────────
    path(
        "streak/",
        JournalStreakView.as_view(),
        name="journal-streak",
    ),
    path(
        "stats/",
        JournalStatsView.as_view(),
        name="journal-stats",
    ),
    # ── Weekly Reflections ────────────────────────────────────────────────
    path(
        "weekly/",
        WeeklySummaryView.as_view(),
        name="weekly-summary",
    ),
    path(
        "weekly/list/",
        WeeklyReflectionListView.as_view(),
        name="weekly-list",
    ),
    # ── Social Feed ───────────────────────────────────────────────────────
    path(
        "feed/",
        JournalSocialFeedView.as_view(),
        name="social-feed",
    ),
    # ── Prompts ───────────────────────────────────────────────────────────
    path(
        "prompt/",
        ReflectionPromptView.as_view(),
        name="reflection-prompt",
    ),
    # ── Templates ─────────────────────────────────────────────────────────
    path(
        "templates/",
        JournalTemplateListCreateView.as_view(),
        name="template-list",
    ),
]
