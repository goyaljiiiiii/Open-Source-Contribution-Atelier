"""
DRF views for the Flashcards & Spaced Repetition app.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import generics, permissions, status, views
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import (
    Deck,
    DeckShare,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)
from .serializers import (
    DeckCloneSerializer,
    DeckSerializer,
    DeckStatsSerializer,
    FlashcardCreateBulkSerializer,
    FlashcardSerializer,
    ReviewLogSerializer,
    ReviewResponseSerializer,
    ReviewScheduleSerializer,
    ReviewSubmitSerializer,
    StudySessionSerializer,
    StudyStatsSerializer,
)
from .services import (
    clone_deck,
    create_deck_from_lesson,
    get_deck_stats,
    get_due_cards,
    get_new_cards,
    get_user_study_stats,
    process_review,
)

# ---------------------------------------------------------------------------
#  Deck CRUD
# ---------------------------------------------------------------------------


class DeckListCreateView(generics.ListCreateAPIView):
    """List or create flashcard decks."""

    serializer_class = DeckSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Deck.objects.filter(user=self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DeckDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a flashcard deck."""

    serializer_class = DeckSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Deck.objects.filter(user=self.request.user)


class PublicDeckListView(generics.ListAPIView):
    """List public decks available for cloning."""

    serializer_class = DeckSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return (
            Deck.objects.filter(is_public=True)
            .exclude(user=self.request.user)
            .order_by("-clone_count")
        )


class DeckCloneView(views.APIView):
    """Clone a public deck for the authenticated user."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DeckCloneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            source = Deck.objects.get(
                id=serializer.validated_data["deck_id"],
                is_public=True,
            )
        except Deck.DoesNotExist:
            return Response(
                {"error": "Public deck not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already cloned
        if DeckShare.objects.filter(
            source_deck=source, cloned_by=request.user
        ).exists():
            return Response(
                {"error": "You already have a clone of this deck."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_deck = clone_deck(source, request.user)
        return Response(
            DeckSerializer(new_deck, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
#  Flashcard CRUD
# ---------------------------------------------------------------------------


class FlashcardListCreateView(generics.ListCreateAPIView):
    """List or create flashcards in a deck."""

    serializer_class = FlashcardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        deck_id = self.kwargs["deck_id"]
        return Flashcard.objects.filter(
            deck_id=deck_id,
            deck__user=self.request.user,
        ).order_by("order", "id")

    def perform_create(self, serializer):
        deck = Deck.objects.get(
            id=self.kwargs["deck_id"],
            user=self.request.user,
        )
        card = serializer.save(deck=deck)
        deck.recalculate_card_count()
        # Auto-create review schedule for the card
        ReviewSchedule.objects.get_or_create(
            user=self.request.user,
            flashcard=card,
            defaults={"next_review": timezone.now()},
        )


class FlashcardBulkCreateView(views.APIView):
    """Bulk-create flashcards in a deck."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, deck_id):
        try:
            deck = Deck.objects.get(id=deck_id, user=request.user)
        except Deck.DoesNotExist:
            return Response(
                {"error": "Deck not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = FlashcardCreateBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cards_data = serializer.validated_data["cards"]
        max_order = Flashcard.objects.filter(deck=deck).count()
        cards = []
        schedules = []

        for i, card_data in enumerate(cards_data):
            card = Flashcard(
                deck=deck,
                front=card_data["front"],
                back=card_data["back"],
                hint=card_data.get("hint", ""),
                difficulty=card_data.get("difficulty", "medium"),
                tags=card_data.get("tags", []),
                order=max_order + i,
            )
            cards.append(card)

        Flashcard.objects.bulk_create(cards)

        # Create review schedules for all new cards
        created_cards = Flashcard.objects.filter(deck=deck).order_by("-id")[
            : len(cards_data)
        ]
        for card in created_cards:
            schedules.append(
                ReviewSchedule(
                    user=request.user,
                    flashcard=card,
                    next_review=timezone.now(),
                )
            )
        ReviewSchedule.objects.bulk_create(schedules)

        deck.recalculate_card_count()

        return Response(
            {
                "created": len(cards_data),
                "deck_card_count": deck.card_count,
            },
            status=status.HTTP_201_CREATED,
        )


class FlashcardDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a flashcard."""

    serializer_class = FlashcardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Flashcard.objects.filter(
            deck__user=self.request.user,
        )


# ---------------------------------------------------------------------------
#  Reviews
# ---------------------------------------------------------------------------


class DueCardsView(views.APIView):
    """Get cards due for review."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deck_id = request.query_params.get("deck_id")
        limit = int(request.query_params.get("limit", 20))
        limit = max(1, min(50, limit))

        cards = get_due_cards(
            request.user,
            deck_id=deck_id,
            limit=limit,
        )
        return Response(
            {
                "cards": cards,
                "count": len(cards),
            }
        )


class NewCardsView(views.APIView):
    """Get new (unseen) cards for initial learning."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deck_id = request.query_params.get("deck_id")
        limit = int(request.query_params.get("limit", 10))
        limit = max(1, min(30, limit))

        cards = get_new_cards(
            request.user,
            deck_id=deck_id,
            limit=limit,
        )
        return Response(
            {
                "cards": cards,
                "count": len(cards),
            }
        )


class SubmitReviewView(views.APIView):
    """Submit a review for a flashcard."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = process_review(
                user=request.user,
                flashcard_id=serializer.validated_data["card_id"],
                quality=serializer.validated_data["quality"],
                response_time_ms=serializer.validated_data.get("response_time_ms", 0),
            )
        except ReviewSchedule.DoesNotExist:
            return Response(
                {"error": "Card not found in your review queue."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(ReviewResponseSerializer(result).data)


class ReviewHistoryView(generics.ListAPIView):
    """List review history for the user."""

    serializer_class = ReviewLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ReviewLog.objects.filter(
            user=self.request.user,
        ).select_related("flashcard")

        deck_id = self.request.query_params.get("deck_id")
        if deck_id:
            qs = qs.filter(flashcard__deck_id=deck_id)

        return qs[:100]


# ---------------------------------------------------------------------------
#  Study Sessions
# ---------------------------------------------------------------------------


class StudySessionCreateView(views.APIView):
    """Start a study session."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        deck_id = request.data.get("deck_id")
        session_type = request.data.get("session_type", "due")

        deck = None
        if deck_id:
            try:
                deck = Deck.objects.get(id=deck_id, user=request.user)
            except Deck.DoesNotExist:
                return Response(
                    {"error": "Deck not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        session = StudySession.objects.create(
            user=request.user,
            deck=deck,
            session_type=session_type,
        )

        return Response(
            StudySessionSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )


class StudySessionEndView(views.APIView):
    """End a study session and record results."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = StudySession.objects.get(
                id=session_id,
                user=request.user,
                ended_at__isnull=True,
            )
        except StudySession.DoesNotExist:
            return Response(
                {"error": "Active session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        cards_reviewed = request.data.get("cards_reviewed", 0)
        cards_correct = request.data.get("cards_correct", 0)

        from .services import calculate_session_xp

        xp = calculate_session_xp(
            correct_count=cards_correct,
            total_count=cards_reviewed,
            streak=0,
        )

        session.end_session(
            cards_reviewed=cards_reviewed,
            cards_correct=cards_correct,
            xp_earned=xp,
        )

        return Response(
            StudySessionSerializer(session).data,
        )


# ---------------------------------------------------------------------------
#  Statistics
# ---------------------------------------------------------------------------


class DeckStatsView(views.APIView):
    """Get statistics for a specific deck."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, deck_id):
        try:
            deck = Deck.objects.get(id=deck_id, user=request.user)
        except Deck.DoesNotExist:
            return Response(
                {"error": "Deck not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        stats = get_deck_stats(request.user, deck_id)
        return Response(DeckStatsSerializer(stats).data)


class StudyStatsView(views.APIView):
    """Get overall study statistics for the user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats = get_user_study_stats(request.user)
        return Response(StudyStatsSerializer(stats).data)


class UserReviewLogsView(generics.ListAPIView):
    """List all review logs for the authenticated user."""

    serializer_class = ReviewLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReviewLog.objects.filter(
            user=self.request.user,
        ).select_related(
            "flashcard", "schedule"
        )[:200]
