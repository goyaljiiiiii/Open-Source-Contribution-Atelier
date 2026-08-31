"""
Tests for Flashcards API views.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.flashcards.models import (
    Deck,
    DeckShare,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)


class BaseFlashcardTest(TestCase):
    """Shared test setup."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.deck = Deck.objects.create(user=self.user, title="My Deck")


class DeckListCreateViewTest(BaseFlashcardTest):
    """Tests for DeckListCreateView."""

    def test_list_decks(self):
        url = reverse("flashcards:deck-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_deck(self):
        url = reverse("flashcards:deck-list")
        data = {"title": "New Deck", "description": "A test deck"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Deck")

    def test_unauthenticated(self):
        self.client.force_authenticate(user=None)
        url = reverse("flashcards:deck-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DeckDetailViewTest(BaseFlashcardTest):
    """Tests for DeckDetailView."""

    def test_retrieve(self):
        url = reverse("flashcards:deck-detail", args=[self.deck.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "My Deck")

    def test_update(self):
        url = reverse("flashcards:deck-detail", args=[self.deck.id])
        response = self.client.patch(url, {"title": "Updated"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete(self):
        url = reverse("flashcards:deck-detail", args=[self.deck.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_cannot_access_other_users_deck(self):
        other_deck = Deck.objects.create(user=self.other_user, title="Other")
        url = reverse("flashcards:deck-detail", args=[other_deck.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FlashcardListCreateViewTest(BaseFlashcardTest):
    """Tests for FlashcardListCreateView."""

    def test_list_cards(self):
        Flashcard.objects.create(deck=self.deck, front="Q1", back="A1")
        url = reverse("flashcards:card-list", args=[self.deck.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_card(self):
        url = reverse("flashcards:card-list", args=[self.deck.id])
        data = {"front": "What?", "back": "Answer!"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_card_updates_count(self):
        url = reverse("flashcards:card-list", args=[self.deck.id])
        self.client.post(
            url,
            {"front": "Q", "back": "A"},
            format="json",
        )
        self.deck.refresh_from_db()
        self.assertEqual(self.deck.card_count, 1)


class FlashcardBulkCreateViewTest(BaseFlashcardTest):
    """Tests for FlashcardBulkCreateView."""

    def test_bulk_create(self):
        url = reverse("flashcards:card-bulk-create", args=[self.deck.id])
        data = {
            "cards": [
                {"front": "Q1", "back": "A1"},
                {"front": "Q2", "back": "A2"},
                {"front": "Q3", "back": "A3"},
            ]
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["created"], 3)
        self.deck.refresh_from_db()
        self.assertEqual(self.deck.card_count, 3)

    def test_bulk_create_creates_schedules(self):
        url = reverse("flashcards:card-bulk-create", args=[self.deck.id])
        data = {
            "cards": [
                {"front": "Q1", "back": "A1"},
                {"front": "Q2", "back": "A2"},
            ]
        }
        self.client.post(url, data, format="json")
        schedules = ReviewSchedule.objects.filter(
            user=self.user, flashcard__deck=self.deck
        )
        self.assertEqual(schedules.count(), 2)

    def test_bulk_create_empty_list(self):
        url = reverse("flashcards:card-bulk-create", args=[self.deck.id])
        response = self.client.post(url, {"cards": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_create_missing_front(self):
        url = reverse("flashcards:card-bulk-create", args=[self.deck.id])
        data = {"cards": [{"back": "A1"}]}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FlashcardDetailViewTest(BaseFlashcardTest):
    """Tests for FlashcardDetailView."""

    def setUp(self):
        super().setUp()
        self.card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")

    def test_retrieve(self):
        url = reverse("flashcards:card-detail", args=[self.card.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_front(self):
        url = reverse("flashcards:card-detail", args=[self.card.id])
        response = self.client.patch(url, {"front": "New Q"}, format="json")
        self.assertEqual(response.data["front"], "New Q")

    def test_delete(self):
        url = reverse("flashcards:card-detail", args=[self.card.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class DueCardsViewTest(BaseFlashcardTest):
    """Tests for DueCardsView."""

    def test_no_due_cards(self):
        url = reverse("flashcards:due-cards")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_with_due_cards(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        url = reverse("flashcards:due-cards")
        response = self.client.get(url)
        self.assertEqual(response.data["count"], 1)

    def test_deck_filter(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        url = reverse("flashcards:due-cards")
        response = self.client.get(url, {"deck_id": self.deck.id})
        self.assertEqual(response.data["count"], 1)

    def test_limit(self):
        for _ in range(5):
            card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
            ReviewSchedule.objects.create(
                user=self.user,
                flashcard=card,
                next_review=timezone.now(),
            )
        url = reverse("flashcards:due-cards")
        response = self.client.get(url, {"limit": 2})
        self.assertEqual(response.data["count"], 2)


class NewCardsViewTest(BaseFlashcardTest):
    """Tests for NewCardsView."""

    def test_get_new_cards(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            is_new=True,
            next_review=timezone.now(),
        )
        url = reverse("flashcards:new-cards")
        response = self.client.get(url)
        self.assertEqual(response.data["count"], 1)


class SubmitReviewViewTest(BaseFlashcardTest):
    """Tests for SubmitReviewView."""

    def setUp(self):
        super().setUp()
        self.card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        self.schedule = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )

    def test_submit_good_review(self):
        url = reverse("flashcards:submit-review")
        data = {"card_id": self.card.id, "quality": 2}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_correct"])

    def test_submit_lapse(self):
        url = reverse("flashcards:submit-review")
        data = {"card_id": self.card.id, "quality": 0}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_correct"])

    def test_submit_perfect(self):
        url = reverse("flashcards:submit-review")
        data = {"card_id": self.card.id, "quality": 4}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["xp_earned"], 0)

    def test_invalid_quality(self):
        url = reverse("flashcards:submit-review")
        data = {"card_id": self.card.id, "quality": 5}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_card(self):
        url = reverse("flashcards:submit-review")
        data = {"card_id": 9999, "quality": 2}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_with_response_time(self):
        url = reverse("flashcards:submit-review")
        data = {
            "card_id": self.card.id,
            "quality": 3,
            "response_time_ms": 2500,
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ReviewHistoryViewTest(BaseFlashcardTest):
    """Tests for ReviewHistoryView."""

    def test_empty_history(self):
        url = reverse("flashcards:review-history")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_with_history(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        ReviewLog.objects.create(
            user=self.user,
            flashcard=card,
            schedule=sched,
            rating=3,
            prev_easiness=2.5,
            prev_interval=0,
            prev_repetition=0,
            new_easiness=2.6,
            new_interval=1,
            new_repetition=1,
        )
        url = reverse("flashcards:review-history")
        response = self.client.get(url)
        self.assertEqual(len(response.data), 1)


class StudySessionCreateViewTest(BaseFlashcardTest):
    """Tests for StudySessionCreateView."""

    def test_create_session(self):
        url = reverse("flashcards:session-create")
        data = {"session_type": "due"}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_session_with_deck(self):
        url = reverse("flashcards:session-create")
        data = {
            "deck_id": self.deck.id,
            "session_type": "learn",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_invalid_deck(self):
        url = reverse("flashcards:session-create")
        data = {"deck_id": 9999}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StudySessionEndViewTest(BaseFlashcardTest):
    """Tests for StudySessionEndView."""

    def setUp(self):
        super().setUp()
        self.session = StudySession.objects.create(user=self.user, session_type="due")

    def test_end_session(self):
        url = reverse("flashcards:session-end", args=[self.session.id])
        data = {"cards_reviewed": 10, "cards_correct": 8}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["xp_earned"], 0)

    def test_end_nonexistent(self):
        url = reverse("flashcards:session-end", args=[9999])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_end_already_ended(self):
        self.session.end_session()
        url = reverse("flashcards:session-end", args=[self.session.id])
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class DeckStatsViewTest(BaseFlashcardTest):
    """Tests for DeckStatsView."""

    def test_empty_deck_stats(self):
        url = reverse("flashcards:deck-stats", args=[self.deck.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_cards"], 0)

    def test_with_cards(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        url = reverse("flashcards:deck-stats", args=[self.deck.id])
        response = self.client.get(url)
        self.assertEqual(response.data["total_cards"], 1)

    def test_nonexistent_deck(self):
        url = reverse("flashcards:deck-stats", args=[9999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StudyStatsViewTest(BaseFlashcardTest):
    """Tests for StudyStatsView."""

    def test_empty_stats(self):
        self.deck.delete()
        url = reverse("flashcards:study-stats")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_decks"], 0)


class DeckCloneViewTest(BaseFlashcardTest):
    """Tests for DeckCloneView."""

    def setUp(self):
        super().setUp()
        self.public_deck = Deck.objects.create(
            user=self.other_user,
            title="Public Deck",
            is_public=True,
        )
        Flashcard.objects.create(deck=self.public_deck, front="Q", back="A")

    def test_clone_deck(self):
        url = reverse("flashcards:deck-clone")
        data = {"deck_id": self.public_deck.id}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_clone_nonexistent(self):
        url = reverse("flashcards:deck-clone")
        data = {"deck_id": 9999}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_clone_private_deck(self):
        private = Deck.objects.create(user=self.other_user, title="Private")
        url = reverse("flashcards:deck-clone")
        data = {"deck_id": private.id}
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_clone_already_cloned(self):
        url = reverse("flashcards:deck-clone")
        self.client.post(
            url,
            {"deck_id": self.public_deck.id},
            format="json",
        )
        response = self.client.post(
            url,
            {"deck_id": self.public_deck.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PublicDeckListViewTest(BaseFlashcardTest):
    """Tests for PublicDeckListView."""

    def test_list_public_decks(self):
        Deck.objects.create(
            user=self.other_user,
            title="Public",
            is_public=True,
        )
        url = reverse("flashcards:public-deck-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_excludes_own_decks(self):
        Deck.objects.create(
            user=self.user,
            title="Mine",
            is_public=True,
        )
        url = reverse("flashcards:public-deck-list")
        response = self.client.get(url)
        data = (
            response.data["results"]
            if isinstance(response.data, dict)
            else response.data
        )
        self.assertEqual(len(data), 0)
