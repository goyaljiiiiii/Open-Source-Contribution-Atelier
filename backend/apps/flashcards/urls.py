"""
URL patterns for the Flashcards & Spaced Repetition app.
"""

from django.urls import path

from .views import (
    DeckCloneView,
    DeckDetailView,
    DeckListCreateView,
    DeckStatsView,
    DueCardsView,
    FlashcardBulkCreateView,
    FlashcardDetailView,
    FlashcardListCreateView,
    NewCardsView,
    PublicDeckListView,
    ReviewHistoryView,
    ReviewLogSerializer,
    SubmitReviewView,
    StudySessionCreateView,
    StudySessionEndView,
    StudyStatsView,
    UserReviewLogsView,
)

app_name = "flashcards"

urlpatterns = [
    # ── Decks ─────────────────────────────────────────────────────────────
    path(
        "decks/",
        DeckListCreateView.as_view(),
        name="deck-list",
    ),
    path(
        "decks/public/",
        PublicDeckListView.as_view(),
        name="public-deck-list",
    ),
    path(
        "decks/<int:pk>/",
        DeckDetailView.as_view(),
        name="deck-detail",
    ),
    path(
        "decks/clone/",
        DeckCloneView.as_view(),
        name="deck-clone",
    ),
    path(
        "decks/<int:deck_id>/stats/",
        DeckStatsView.as_view(),
        name="deck-stats",
    ),
    # ── Flashcards ────────────────────────────────────────────────────────
    path(
        "decks/<int:deck_id>/cards/",
        FlashcardListCreateView.as_view(),
        name="card-list",
    ),
    path(
        "decks/<int:deck_id>/cards/bulk/",
        FlashcardBulkCreateView.as_view(),
        name="card-bulk-create",
    ),
    path(
        "cards/<int:pk>/",
        FlashcardDetailView.as_view(),
        name="card-detail",
    ),
    # ── Reviews ───────────────────────────────────────────────────────────
    path(
        "reviews/due/",
        DueCardsView.as_view(),
        name="due-cards",
    ),
    path(
        "reviews/new/",
        NewCardsView.as_view(),
        name="new-cards",
    ),
    path(
        "reviews/submit/",
        SubmitReviewView.as_view(),
        name="submit-review",
    ),
    path(
        "reviews/history/",
        ReviewHistoryView.as_view(),
        name="review-history",
    ),
    # ── Study Sessions ────────────────────────────────────────────────────
    path(
        "sessions/",
        StudySessionCreateView.as_view(),
        name="session-create",
    ),
    path(
        "sessions/<int:session_id>/end/",
        StudySessionEndView.as_view(),
        name="session-end",
    ),
    # ── Stats ─────────────────────────────────────────────────────────────
    path(
        "stats/",
        StudyStatsView.as_view(),
        name="study-stats",
    ),
    path(
        "review-logs/",
        UserReviewLogsView.as_view(),
        name="review-logs",
    ),
]
