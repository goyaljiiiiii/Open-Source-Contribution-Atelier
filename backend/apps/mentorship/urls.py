"""URL patterns for the Mentorship app."""

from django.urls import path

from .views import (
    FeedbackListCreateView,
    FindMentorsView,
    IncomingRequestListView,
    MatchDetailView,
    MatchGoalListCreateView,
    MatchRecommendationsView,
    MentorAnalyticsView,
    MentorProfileDetailView,
    MentorProfileListCreateView,
    MentorshipMatchListView,
    MentorshipRequestListCreateView,
    MenteeAnalyticsView,
    MyMentorProfileView,
    ProgramStatsView,
    RespondToRequestView,
    SessionCompleteView,
    SessionDetailView,
    SessionListCreateView,
    SessionStartView,
)

app_name = "mentorship"

urlpatterns = [
    # ── Mentor Profiles ───────────────────────────────────────────────────
    path(
        "mentors/",
        MentorProfileListCreateView.as_view(),
        name="mentor-list",
    ),
    path(
        "mentors/me/",
        MyMentorProfileView.as_view(),
        name="my-mentor-profile",
    ),
    path(
        "mentors/profile/",
        MentorProfileDetailView.as_view(),
        name="mentor-profile",
    ),
    path(
        "mentors/find/",
        FindMentorsView.as_view(),
        name="find-mentors",
    ),
    # ── Requests ──────────────────────────────────────────────────────────
    path(
        "requests/",
        MentorshipRequestListCreateView.as_view(),
        name="request-list",
    ),
    path(
        "requests/incoming/",
        IncomingRequestListView.as_view(),
        name="incoming-requests",
    ),
    path(
        "requests/<int:request_id>/respond/",
        RespondToRequestView.as_view(),
        name="respond-to-request",
    ),
    # ── Matches ───────────────────────────────────────────────────────────
    path(
        "matches/",
        MentorshipMatchListView.as_view(),
        name="match-list",
    ),
    path(
        "matches/<int:pk>/",
        MatchDetailView.as_view(),
        name="match-detail",
    ),
    path(
        "matches/<int:match_id>/recommendations/",
        MatchRecommendationsView.as_view(),
        name="match-recommendations",
    ),
    # ── Sessions ──────────────────────────────────────────────────────────
    path(
        "sessions/",
        SessionListCreateView.as_view(),
        name="session-list",
    ),
    path(
        "sessions/<int:pk>/",
        SessionDetailView.as_view(),
        name="session-detail",
    ),
    path(
        "sessions/<int:session_id>/start/",
        SessionStartView.as_view(),
        name="session-start",
    ),
    path(
        "sessions/<int:session_id>/complete/",
        SessionCompleteView.as_view(),
        name="session-complete",
    ),
    # ── Goals ─────────────────────────────────────────────────────────────
    path(
        "matches/<int:match_id>/goals/",
        MatchGoalListCreateView.as_view(),
        name="match-goals",
    ),
    # ── Feedback ──────────────────────────────────────────────────────────
    path(
        "matches/<int:match_id>/feedback/",
        FeedbackListCreateView.as_view(),
        name="match-feedback",
    ),
    # ── Analytics ─────────────────────────────────────────────────────────
    path(
        "analytics/mentor/",
        MentorAnalyticsView.as_view(),
        name="mentor-analytics",
    ),
    path(
        "analytics/mentee/",
        MenteeAnalyticsView.as_view(),
        name="mentee-analytics",
    ),
    path(
        "analytics/program/",
        ProgramStatsView.as_view(),
        name="program-stats",
    ),
]
