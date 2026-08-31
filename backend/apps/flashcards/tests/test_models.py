"""
Tests for Flashcards models.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.flashcards.models import (
    Deck,
    DeckShare,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)


class DeckModelTest(TestCase):
    """Tests for Deck model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_deck(self):
        deck = Deck.objects.create(
            user=self.user,
            title="Git Basics",
            description="Learn git fundamentals",
        )
        self.assertEqual(deck.title, "Git Basics")
        self.assertEqual(deck.card_count, 0)
        self.assertFalse(deck.is_public)

    def test_str(self):
        deck = Deck.objects.create(
            user=self.user,
            title="Python Cards",
            card_count=15,
        )
        self.assertIn("Python Cards", str(deck))
        self.assertIn("15 cards", str(deck))

    def test_recalculate_card_count(self):
        deck = Deck.objects.create(user=self.user, title="Test Deck")
        Flashcard.objects.create(deck=deck, front="Q1", back="A1")
        Flashcard.objects.create(deck=deck, front="Q2", back="A2")
        deck.recalculate_card_count()
        deck.refresh_from_db()
        self.assertEqual(deck.card_count, 2)

    def test_deck_types(self):
        for dtype in ["custom", "lesson", "skill", "imported"]:
            deck = Deck.objects.create(
                user=self.user,
                title=f"Deck {dtype}",
                deck_type=dtype,
            )
            self.assertEqual(deck.deck_type, dtype)


class FlashcardModelTest(TestCase):
    """Tests for Flashcard model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Test Deck")

    def test_create_card(self):
        card = Flashcard.objects.create(
            deck=self.deck,
            front="What is git?",
            back="A version control system",
            hint="Think about tracking changes",
            difficulty="medium",
        )
        self.assertEqual(card.front, "What is git?")
        self.assertFalse(card.is_suspended)

    def test_str(self):
        card = Flashcard.objects.create(deck=self.deck, front="Q", back="A", order=3)
        self.assertIn("Card #3", str(card))
        self.assertIn("Test Deck", str(card))

    def test_tags(self):
        card = Flashcard.objects.create(
            deck=self.deck,
            front="Q",
            back="A",
            tags=["git", "basics"],
        )
        self.assertEqual(card.tags, ["git", "basics"])

    def test_suspend_card(self):
        card = Flashcard.objects.create(
            deck=self.deck,
            front="Q",
            back="A",
            is_suspended=True,
        )
        self.assertTrue(card.is_suspended)


class ReviewScheduleModelTest(TestCase):
    """Tests for ReviewSchedule model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")
        self.card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")

    def test_create_schedule(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )
        self.assertEqual(sched.easiness_factor, 2.5)
        self.assertEqual(sched.interval_days, 0)
        self.assertTrue(sched.is_new)

    def test_str_new(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )
        self.assertIn("new", str(sched))

    def test_str_reviewed(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
            is_new=False,
            easiness_factor=2.1,
        )
        self.assertIn("EF=2.1", str(sched))

    def test_accuracy_pct_no_reviews(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )
        self.assertEqual(sched.accuracy_pct, 0.0)

    def test_accuracy_pct_with_reviews(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
            total_reviews=10,
            correct_reviews=8,
        )
        self.assertEqual(sched.accuracy_pct, 80.0)

    def test_is_due(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now() - timedelta(hours=1),
        )
        self.assertTrue(sched.is_due)

    def test_is_not_due(self):
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now() + timedelta(hours=1),
        )
        self.assertFalse(sched.is_due)

    def test_maturity_labels(self):
        # New
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
            is_new=True,
        )
        self.assertEqual(sched.maturity_label, "new")

        # Learning
        sched.is_new = False
        sched.interval_days = 0
        sched.save()
        self.assertEqual(sched.maturity_label, "learning")

        # Young
        sched.interval_days = 10
        sched.save()
        self.assertEqual(sched.maturity_label, "young")

        # Mature
        sched.interval_days = 30
        sched.save()
        self.assertEqual(sched.maturity_label, "mature")

    def test_unique_together(self):
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )
        with self.assertRaises(Exception):
            ReviewSchedule.objects.create(
                user=self.user,
                flashcard=self.card,
                next_review=timezone.now(),
            )


class ReviewLogModelTest(TestCase):
    """Tests for ReviewLog model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")
        self.card = Flashcard.objects.create(deck=self.deck, front="Q", back="A")
        self.schedule = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )

    def test_create_log(self):
        log = ReviewLog.objects.create(
            user=self.user,
            flashcard=self.card,
            schedule=self.schedule,
            rating=3,
            prev_easiness=2.5,
            prev_interval=0,
            prev_repetition=0,
            new_easiness=2.6,
            new_interval=1,
            new_repetition=1,
            response_time_ms=2500,
        )
        self.assertEqual(log.rating, 3)
        self.assertEqual(log.response_time_ms, 2500)

    def test_str(self):
        log = ReviewLog.objects.create(
            user=self.user,
            flashcard=self.card,
            schedule=self.schedule,
            rating=2,
            prev_easiness=2.5,
            prev_interval=0,
            prev_repetition=0,
            new_easiness=2.5,
            new_interval=1,
            new_repetition=1,
        )
        self.assertIn("Review 2", str(log))
        self.assertIn("testuser", str(log))


class StudySessionModelTest(TestCase):
    """Tests for StudySession model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_session(self):
        session = StudySession.objects.create(
            user=self.user,
            session_type="due",
            cards_reviewed=10,
            cards_correct=8,
            xp_earned=45,
        )
        self.assertEqual(session.session_type, "due")

    def test_accuracy(self):
        session = StudySession(
            user=self.user,
            cards_reviewed=10,
            cards_correct=8,
        )
        self.assertEqual(session.accuracy_pct, 80.0)

    def test_accuracy_zero(self):
        session = StudySession(user=self.user)
        self.assertEqual(session.accuracy_pct, 0.0)

    def test_str(self):
        session = StudySession.objects.create(
            user=self.user,
            session_type="learn",
            cards_reviewed=5,
        )
        self.assertIn("testuser", str(session))
        self.assertIn("5 cards", str(session))


class DeckShareModelTest(TestCase):
    """Tests for DeckShare model."""

    def setUp(self):
        self.user1 = User.objects.create_user(username="user1", password="pass123")
        self.user2 = User.objects.create_user(username="user2", password="pass123")
        self.deck = Deck.objects.create(
            user=self.user1,
            title="Public Deck",
            is_public=True,
        )

    def test_create_share(self):
        share = DeckShare.objects.create(
            source_deck=self.deck,
            cloned_by=self.user2,
        )
        self.assertEqual(share.source_deck, self.deck)

    def test_str(self):
        share = DeckShare.objects.create(
            source_deck=self.deck,
            cloned_by=self.user2,
        )
        self.assertIn("user2", str(share))
