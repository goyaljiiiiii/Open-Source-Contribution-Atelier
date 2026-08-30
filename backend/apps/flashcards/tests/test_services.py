"""
Tests for the Flashcard services — SM-2 engine, review processing, stats.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.flashcards.models import (
    Deck,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)
from apps.flashcards.services import (
    calculate_session_xp,
    clone_deck,
    compute_next_review,
    create_deck_from_lesson,
    get_deck_stats,
    get_due_cards,
    get_new_cards,
    get_user_study_stats,
    process_review,
)


class ComputeNextReviewTest(TestCase):
    """Tests for the core SM-2 algorithm implementation."""

    def test_first_good_review(self):
        """First successful review → interval should be 1 day."""
        ef, interval, rep = compute_next_review(2.5, 0, 0, quality=2)
        self.assertEqual(interval, 1)
        self.assertEqual(rep, 1)
        self.assertGreaterEqual(ef, 1.3)

    def test_second_good_review(self):
        """Second successful review → interval should be 6 days."""
        ef, interval, rep = compute_next_review(2.5, 1, 1, quality=2)
        self.assertEqual(interval, 6)
        self.assertEqual(rep, 2)

    def test_subsequent_review_good(self):
        """After 2+ successful reviews, interval grows with EF."""
        ef, interval, rep = compute_next_review(2.5, 6, 2, quality=2)
        self.assertGreater(interval, 6)
        self.assertEqual(rep, 3)

    def test_easy_bonus(self):
        """Quality 3 (easy) gets a 1.3x multiplier."""
        ef_good, int_good, _ = compute_next_review(2.5, 10, 3, quality=2)
        ef_easy, int_easy, _ = compute_next_review(2.5, 10, 3, quality=3)
        self.assertGreater(int_easy, int_good)

    def test_perfect_bonus(self):
        """Quality 4 (perfect) gets a 1.5x multiplier."""
        ef_g, int_g, _ = compute_next_review(2.5, 10, 3, quality=2)
        ef_p, int_p, _ = compute_next_review(2.5, 10, 3, quality=4)
        self.assertGreater(int_p, int_g)

    def test_lapse_resets_repetition(self):
        """Quality < 2 should reset repetition to 0 and interval to 1."""
        ef, interval, rep = compute_next_review(2.5, 10, 5, quality=0)
        self.assertEqual(rep, 0)
        self.assertEqual(interval, 1)

    def test_hard_does_not_lapse(self):
        """Quality 1 is a 'hard' rating, not a lapse... but in our
        implementation quality < 2 = lapse."""
        ef, interval, rep = compute_next_review(2.5, 10, 3, quality=1)
        # quality=1 is still < 2, so it lapses
        self.assertEqual(rep, 0)

    def test_ef_minimum_floor(self):
        """EF should never drop below 1.3."""
        ef, _, _ = compute_next_review(1.4, 1, 1, quality=0)
        self.assertGreaterEqual(ef, 1.3)

    def test_ef_maximum_cap(self):
        """EF should never exceed 3.0."""
        ef, _, _ = compute_next_review(2.9, 1, 1, quality=4)
        self.assertLessEqual(ef, 3.0)

    def test_quality_range(self):
        """All valid qualities should produce valid results."""
        for q in range(5):
            ef, interval, rep = compute_next_review(2.5, 5, 2, quality=q)
            self.assertGreaterEqual(ef, 1.3)
            self.assertLessEqual(ef, 3.0)
            self.assertGreaterEqual(interval, 0)

    def test_interval_grows_over_time(self):
        """Interval should generally increase with consecutive good reviews."""
        intervals = []
        ef = 2.5
        interval = 0
        rep = 0
        for _ in range(5):
            ef, interval, rep = compute_next_review(ef, interval, rep, quality=2)
            intervals.append(interval)

        # After the first two reviews, intervals should grow
        self.assertGreater(intervals[2], intervals[1])
        self.assertGreater(intervals[3], intervals[2])


class ProcessReviewTest(TestCase):
    """Tests for process_review service function."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")
        self.card = Flashcard.objects.create(
            deck=self.deck, front="Q?", back="A!"
        )
        self.schedule = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=self.card,
            next_review=timezone.now(),
        )

    def test_process_good_review(self):
        result = process_review(self.user, self.card.id, quality=2)
        self.assertTrue(result["is_correct"])
        self.assertEqual(result["quality"], 2)
        self.assertIn("new_easiness", result)
        self.assertIn("next_review", result)

    def test_process_lapse(self):
        result = process_review(self.user, self.card.id, quality=0)
        self.assertFalse(result["is_correct"])
        self.assertEqual(result["new_interval_days"], 1)

    def test_process_perfect(self):
        result = process_review(self.user, self.card.id, quality=4)
        self.assertTrue(result["is_correct"])
        self.assertGreaterEqual(result["new_interval_days"], 1)

    def test_invalid_quality(self):
        with self.assertRaises(ValueError):
            process_review(self.user, self.card.id, quality=5)

    def test_invalid_quality_negative(self):
        with self.assertRaises(ValueError):
            process_review(self.user, self.card.id, quality=-1)

    def test_creates_review_log(self):
        process_review(self.user, self.card.id, quality=3)
        self.assertEqual(ReviewLog.objects.count(), 1)
        log = ReviewLog.objects.first()
        self.assertEqual(log.rating, 3)

    def test_updates_schedule(self):
        process_review(self.user, self.card.id, quality=2)
        self.schedule.refresh_from_db()
        self.assertFalse(self.schedule.is_new)
        self.assertEqual(self.schedule.total_reviews, 1)

    def test_streak_increments_on_good(self):
        process_review(self.user, self.card.id, quality=3)
        process_review(self.user, self.card.id, quality=3)
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.streak, 2)

    def test_streak_resets_on_lapse(self):
        process_review(self.user, self.card.id, quality=3)
        process_review(self.user, self.card.id, quality=3)
        process_review(self.user, self.card.id, quality=0)  # lapse
        self.schedule.refresh_from_db()
        self.assertEqual(self.schedule.streak, 0)

    def test_xp_earned(self):
        result = process_review(self.user, self.card.id, quality=2)
        self.assertGreater(result["xp_earned"], 0)

    def test_xp_zero_on_lapse(self):
        result = process_review(self.user, self.card.id, quality=0)
        self.assertEqual(result["xp_earned"], 0)

    def test_streak_bonus_xp(self):
        """After 5 consecutive good reviews, bonus XP should apply."""
        for _ in range(4):
            process_review(self.user, self.card.id, quality=3)
        result = process_review(self.user, self.card.id, quality=3)
        # 5th review → streak = 5 → bonus
        self.assertGreaterEqual(result["xp_earned"], 8 + 10)

    def test_response_time_recorded(self):
        result = process_review(
            self.user, self.card.id, quality=2, response_time_ms=3500
        )
        log = ReviewLog.objects.first()
        self.assertEqual(log.response_time_ms, 3500)

    def test_maturity_label(self):
        result = process_review(self.user, self.card.id, quality=3)
        self.assertIn(result["maturity"], ("learning", "young", "mature"))


class GetDueCardsTest(TestCase):
    """Tests for get_due_cards service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.other_user = User.objects.create_user(
            username="otheruser", password="otherpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")

    def _make_card(self, due=True, new=True):
        card = Flashcard.objects.create(
            deck=self.deck, front="Q", back="A"
        )
        sched = ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now() if due else timezone.now() + timedelta(days=7),
            is_new=new,
        )
        return card, sched

    def test_no_due_cards(self):
        result = get_due_cards(self.user, deck_id=self.deck.id)
        self.assertEqual(len(result), 0)

    def test_with_due_cards(self):
        self._make_card(due=True, new=False)
        result = get_due_cards(self.user, deck_id=self.deck.id)
        self.assertEqual(len(result), 1)

    def test_limit(self):
        for _ in range(5):
            self._make_card(due=True, new=False)
        result = get_due_cards(self.user, deck_id=self.deck.id, limit=3)
        self.assertEqual(len(result), 3)

    def test_excludes_other_users(self):
        card = Flashcard.objects.create(
            deck=self.deck, front="Q", back="A"
        )
        ReviewSchedule.objects.create(
            user=self.other_user,
            flashcard=card,
            next_review=timezone.now(),
        )
        result = get_due_cards(self.user)
        self.assertEqual(len(result), 0)

    def test_excludes_suspended(self):
        card = Flashcard.objects.create(
            deck=self.deck, front="Q", back="A", is_suspended=True
        )
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        result = get_due_cards(self.user)
        self.assertEqual(len(result), 0)


class GetNewCardsTest(TestCase):
    """Tests for get_new_cards service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")

    def test_get_new_cards(self):
        card = Flashcard.objects.create(
            deck=self.deck, front="Q", back="A"
        )
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            is_new=True,
            next_review=timezone.now(),
        )
        result = get_new_cards(self.user, deck_id=self.deck.id)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["is_new"])

    def test_excludes_reviewed(self):
        card = Flashcard.objects.create(
            deck=self.deck, front="Q", back="A"
        )
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            is_new=False,
            next_review=timezone.now(),
        )
        result = get_new_cards(self.user, deck_id=self.deck.id)
        self.assertEqual(len(result), 0)


class CloneDeckTest(TestCase):
    """Tests for clone_deck service."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="pass123"
        )
        self.cloner = User.objects.create_user(
            username="cloner", password="pass123"
        )
        self.source_deck = Deck.objects.create(
            user=self.owner,
            title="Source Deck",
            is_public=True,
            color="#ff0000",
            icon_emoji="📗",
        )
        Flashcard.objects.create(
            deck=self.source_deck, front="Q1", back="A1"
        )
        Flashcard.objects.create(
            deck=self.source_deck, front="Q2", back="A2"
        )

    def test_clone_creates_new_deck(self):
        new_deck = clone_deck(self.source_deck, self.cloner)
        self.assertNotEqual(new_deck.id, self.source_deck.id)
        self.assertEqual(new_deck.user, self.cloner)
        self.assertIn("Clone", new_deck.title)

    def test_clone_copies_cards(self):
        new_deck = clone_deck(self.source_deck, self.cloner)
        self.assertEqual(new_deck.cards.count(), 2)

    def test_clone_creates_review_schedules(self):
        new_deck = clone_deck(self.source_deck, self.cloner)
        from apps.flashcards.models import ReviewSchedule

        schedules = ReviewSchedule.objects.filter(
            user=self.cloner,
            flashcard__deck=new_deck,
        )
        self.assertEqual(schedules.count(), 2)

    def test_clone_increments_count(self):
        clone_deck(self.source_deck, self.cloner)
        self.source_deck.refresh_from_db()
        self.assertEqual(self.source_deck.clone_count, 1)

    def test_clone_creates_share_record(self):
        clone_deck(self.source_deck, self.cloner)
        self.assertTrue(
            DeckShare.objects.filter(
                source_deck=self.source_deck,
                cloned_by=self.cloner,
            ).exists()
        )


class GetDeckStatsTest(TestCase):
    """Tests for get_deck_stats service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.deck = Deck.objects.create(user=self.user, title="Deck")

    def test_empty_deck(self):
        stats = get_deck_stats(self.user, self.deck.id)
        self.assertEqual(stats["total_cards"], 0)
        self.assertEqual(stats["due_now"], 0)

    def test_with_cards(self):
        for i in range(3):
            card = Flashcard.objects.create(
                deck=self.deck, front=f"Q{i}", back=f"A{i}"
            )
            ReviewSchedule.objects.create(
                user=self.user,
                flashcard=card,
                next_review=timezone.now() if i < 2 else timezone.now() + timedelta(days=7),
                is_new=i == 0,
            )
        stats = get_deck_stats(self.user, self.deck.id)
        self.assertEqual(stats["total_cards"], 3)
        self.assertGreater(stats["due_now"], 0)


class GetUserStudyStatsTest(TestCase):
    """Tests for get_user_study_stats service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_empty_stats(self):
        stats = get_user_study_stats(self.user)
        self.assertEqual(stats["total_decks"], 0)
        self.assertEqual(stats["total_cards"], 0)
        self.assertEqual(stats["due_now"], 0)

    def test_with_data(self):
        deck = Deck.objects.create(user=self.user, title="Deck")
        card = Flashcard.objects.create(
            deck=deck, front="Q", back="A"
        )
        ReviewSchedule.objects.create(
            user=self.user,
            flashcard=card,
            next_review=timezone.now(),
        )
        StudySession.objects.create(
            user=self.user,
            cards_reviewed=10,
            xp_earned=50,
        )
        stats = get_user_study_stats(self.user)
        self.assertEqual(stats["total_decks"], 1)
        self.assertEqual(stats["total_cards"], 1)
        self.assertEqual(stats["total_sessions"], 1)


class CalculateSessionXPTest(TestCase):
    """Tests for calculate_session_xp service."""

    def test_zero_cards(self):
        self.assertEqual(calculate_session_xp(0, 0, 0), 0)

    def test_all_correct(self):
        xp = calculate_session_xp(10, 10, 0)
        self.assertGreater(xp, 0)

    def test_all_wrong(self):
        xp = calculate_session_xp(0, 10, 0)
        self.assertEqual(xp, 0)

    def test_accuracy_bonus_90(self):
        """90%+ accuracy should get 1.5x multiplier."""
        xp_90 = calculate_session_xp(9, 10, 0)
        xp_80 = calculate_session_xp(8, 10, 0)
        self.assertGreater(xp_90, xp_80)

    def test_accuracy_bonus_70(self):
        """70%+ accuracy should get 1.2x multiplier."""
        xp_70 = calculate_session_xp(7, 10, 0)
        xp_60 = calculate_session_xp(6, 10, 0)
        self.assertGreater(xp_70, xp_60)

    def test_streak_bonus(self):
        """Streak of 5 should add bonus XP."""
        xp_no_streak = calculate_session_xp(5, 5, 0)
        xp_with_streak = calculate_session_xp(5, 5, 5)
        self.assertGreater(xp_with_streak, xp_no_streak)


class CreateDeckFromLessonTest(TestCase):
    """Tests for create_deck_from_lesson service."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )

    def test_create_from_lesson_with_objectives(self):
        """Create deck from a mock lesson object."""
        from types import SimpleNamespace

        lesson = SimpleNamespace(
            title="Intro to Git",
            learning_objectives=[
                {"question": "What is git?", "answer": "VCS"},
                {"question": "What is a commit?", "answer": "Snapshot"},
            ],
        )
        deck = create_deck_from_lesson(self.user, lesson)
        self.assertEqual(deck.cards.count(), 2)
        self.assertEqual(deck.deck_type, "lesson")

    def test_create_from_lesson_empty_objectives(self):
        from types import SimpleNamespace

        lesson = SimpleNamespace(
            title="Empty Lesson",
            learning_objectives=[],
        )
        deck = create_deck_from_lesson(self.user, lesson)
        self.assertEqual(deck.cards.count(), 0)


from apps.flashcards.models import DeckShare
