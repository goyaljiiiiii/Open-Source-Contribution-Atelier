"""
Tests for Learning Journal models and services.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.learning_journal.models import (
    JournalComment,
    JournalEntry,
    JournalReaction,
    JournalTemplate,
    ReflectionPrompt,
    UserReflectionStreak,
    WeeklyReflection,
)
from apps.learning_journal.services import (
    compute_journal_streak,
    generate_weekly_summary,
    get_journal_stats,
    get_reflection_prompt,
    get_social_feed,
)


class JournalEntryModelTest(TestCase):
    """Tests for JournalEntry model."""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="pass123")

    def test_create_entry(self):
        entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="Learned Django ORM",
            mood=4,
            productivity_score=8,
            hours_spent=2.5,
        )
        self.assertEqual(entry.mood, 4)
        self.assertEqual(entry.xp_earned, 0)

    def test_str(self):
        entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="Django models are powerful",
        )
        self.assertIn("testuser", str(entry))
        self.assertIn("Django models", str(entry))

    def test_word_count_computed(self):
        entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="one two three four five",
        )
        self.assertEqual(entry.word_count, 5)

    def test_unique_date(self):
        today = timezone.now().date()
        JournalEntry.objects.create(user=self.user, date=today, what_i_learned="First")
        with self.assertRaises(Exception):
            JournalEntry.objects.create(
                user=self.user, date=today, what_i_learned="Second"
            )

    def test_tags(self):
        entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="Test",
            tags=["python", "django"],
        )
        self.assertEqual(entry.tags, ["python", "django"])

    def test_mood_choices(self):
        for mood in range(1, 6):
            entry = JournalEntry.objects.create(
                user=self.user,
                date=timezone.now().date() - timedelta(days=mood),
                what_i_learned=f"Mood {mood}",
                mood=mood,
            )
            self.assertEqual(entry.mood, mood)


class JournalCommentModelTest(TestCase):
    """Tests for JournalComment model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")
        self.entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="Test",
        )

    def test_create_comment(self):
        c = JournalComment.objects.create(
            entry=self.entry,
            user=self.user,
            content="Great insight!",
        )
        self.assertFalse(c.is_mentor_note)

    def test_mentor_note(self):
        mentor = User.objects.create_user(username="mentor", password="p")
        c = JournalComment.objects.create(
            entry=self.entry,
            user=mentor,
            content="Keep it up!",
            is_mentor_note=True,
        )
        self.assertTrue(c.is_mentor_note)


class JournalReactionModelTest(TestCase):
    """Tests for JournalReaction model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")
        self.entry = JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="Test",
        )

    def test_create_reaction(self):
        r = JournalReaction.objects.create(
            entry=self.entry,
            user=self.user,
            reaction_type="like",
        )
        self.assertEqual(r.reaction_type, "like")

    def test_unique_reaction(self):
        JournalReaction.objects.create(
            entry=self.entry, user=self.user, reaction_type="like"
        )
        with self.assertRaises(Exception):
            JournalReaction.objects.create(
                entry=self.entry, user=self.user, reaction_type="like"
            )


class ReflectionPromptModelTest(TestCase):
    """Tests for ReflectionPrompt model."""

    def test_create_prompt(self):
        p = ReflectionPrompt.objects.create(
            text="What challenged you today?",
            prompt_type="daily",
        )
        self.assertTrue(p.is_active)
        self.assertEqual(p.times_used, 0)


class JournalTemplateModelTest(TestCase):
    """Tests for JournalTemplate model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_create_template(self):
        t = JournalTemplate.objects.create(
            name="Daily Reflection",
            created_by=self.user,
            sections=["What I learned", "Challenges", "Goals"],
        )
        self.assertFalse(t.is_public)

    def test_str(self):
        t = JournalTemplate.objects.create(name="My Template", created_by=self.user)
        self.assertEqual(str(t), "My Template")


class WeeklyReflectionModelTest(TestCase):
    """Tests for WeeklyReflection model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_create(self):
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        wr = WeeklyReflection.objects.create(
            user=self.user,
            week_start=week_start,
            summary="Good week!",
            entries_count=5,
            total_words=1000,
        )
        self.assertEqual(wr.entries_count, 5)


class UserReflectionStreakModelTest(TestCase):
    """Tests for UserReflectionStreak model."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_create_streak(self):
        s = UserReflectionStreak.objects.create(user=self.user)
        self.assertEqual(s.current_streak, 0)
        self.assertEqual(s.total_entries, 0)


# ---------------------------------------------------------------------------
#  Service Tests
# ---------------------------------------------------------------------------


class ComputeJournalStreakTest(TestCase):
    """Tests for compute_journal_streak service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_no_entries(self):
        result = compute_journal_streak(self.user)
        self.assertEqual(result["current_streak"], 0)

    def test_single_day(self):
        today = timezone.now().date()
        JournalEntry.objects.create(user=self.user, date=today, what_i_learned="X")
        result = compute_journal_streak(self.user)
        self.assertEqual(result["current_streak"], 1)

    def test_consecutive_days(self):
        today = timezone.now().date()
        for i in range(5):
            JournalEntry.objects.create(
                user=self.user,
                date=today - timedelta(days=i),
                what_i_learned=f"Day {i}",
            )
        result = compute_journal_streak(self.user)
        self.assertEqual(result["current_streak"], 5)

    def test_broken_streak(self):
        today = timezone.now().date()
        JournalEntry.objects.create(user=self.user, date=today, what_i_learned="Today")
        JournalEntry.objects.create(
            user=self.user,
            date=today - timedelta(days=2),
            what_i_learned="Two days ago",
        )
        result = compute_journal_streak(self.user)
        self.assertEqual(result["current_streak"], 1)


class GenerateWeeklySummaryTest(TestCase):
    """Tests for generate_weekly_summary service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_empty_week(self):
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        result = generate_weekly_summary(self.user, week_start)
        self.assertEqual(result["entries_count"], 0)
        self.assertIn("No entries", result["summary"])

    def test_with_entries(self):
        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        for i in range(3):
            JournalEntry.objects.create(
                user=self.user,
                date=week_start + timedelta(days=i),
                what_i_learned=f"Learned {i}",
                mood=4,
                productivity_score=7,
                hours_spent=1.5,
                tags=["python"],
            )
        result = generate_weekly_summary(self.user, week_start)
        self.assertEqual(result["entries_count"], 3)
        self.assertGreater(result["total_words"], 0)


class GetJournalStatsTest(TestCase):
    """Tests for get_journal_stats service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_empty_stats(self):
        stats = get_journal_stats(self.user)
        self.assertEqual(stats["total_entries"], 0)

    def test_with_entries(self):
        today = timezone.now().date()
        for i in range(5):
            JournalEntry.objects.create(
                user=self.user,
                date=today - timedelta(days=i),
                what_i_learned=f"Day {i}",
                mood=4,
                productivity_score=7,
                hours_spent=1.0,
                tags=["python"],
            )
        stats = get_journal_stats(self.user)
        self.assertEqual(stats["total_entries"], 5)
        self.assertEqual(stats["entries_this_week"], 5)


class GetSocialFeedTest(TestCase):
    """Tests for get_social_feed service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")
        self.other = User.objects.create_user(username="other", password="p")

    def test_empty_feed(self):
        feed = get_social_feed(self.user)
        self.assertEqual(len(feed), 0)

    def test_public_entries(self):
        JournalEntry.objects.create(
            user=self.other,
            date=timezone.now().date(),
            what_i_learned="Public entry",
            visibility="public",
        )
        feed = get_social_feed(self.user)
        self.assertEqual(len(feed), 1)

    def test_excludes_private(self):
        JournalEntry.objects.create(
            user=self.other,
            date=timezone.now().date(),
            what_i_learned="Private",
            visibility="private",
        )
        feed = get_social_feed(self.user)
        self.assertEqual(len(feed), 0)

    def test_excludes_own(self):
        JournalEntry.objects.create(
            user=self.user,
            date=timezone.now().date(),
            what_i_learned="My own",
            visibility="public",
        )
        feed = get_social_feed(self.user)
        self.assertEqual(len(feed), 0)


class GetReflectionPromptTest(TestCase):
    """Tests for get_reflection_prompt service."""

    def setUp(self):
        self.user = User.objects.create_user(username="user1", password="p")

    def test_default_prompt(self):
        result = get_reflection_prompt(self.user)
        self.assertIn("text", result)
        self.assertIn("type", result)

    def test_with_prompts(self):
        ReflectionPrompt.objects.create(text="Custom prompt?", prompt_type="daily")
        result = get_reflection_prompt(self.user)
        self.assertEqual(result["text"], "Custom prompt?")
