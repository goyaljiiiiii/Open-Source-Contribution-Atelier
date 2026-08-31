from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.content.models import Lesson
from apps.progress.services.digest_service import WeeklyDigestService

User = get_user_model()


class WeeklySummarySpecialCharactersTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="coder_sam", email="sam@example.com", password="password123"
        )

    def test_format_markdown_lesson_link_escapes_brackets_in_title(self):
        """Brackets in lesson titles should be escaped with backslashes in Markdown link text."""
        title = "[Advanced] Git Rebase & [Merge] Conflict Guide"
        slug = "git-rebase-merge"

        link = WeeklyDigestService.format_markdown_lesson_link(title, slug)
        self.assertEqual(
            link,
            r"[\[Advanced\] Git Rebase & \[Merge\] Conflict Guide](https://atelier.dev/lessons/git-rebase-merge)",
        )

    def test_format_markdown_lesson_link_encodes_special_slug_characters(self):
        """Special characters like spaces, hashes, plus signs, and parens in slugs must be encoded."""
        title = "C++ & C# OOP (Beginner's Course)"
        slug = "c++ & c# (beginner)"

        link = WeeklyDigestService.format_markdown_lesson_link(title, slug)
        # Should not have unencoded raw parentheses or spaces breaking markdown [text](url)
        self.assertIn(
            "https://atelier.dev/lessons/c%2B%2B%20%26%20c%23%20%28beginner%29", link
        )
        self.assertNotIn("(beginner)", link.split("](")[1])

    def test_generate_markdown_summary_with_special_char_lessons(self):
        """Digest summary generator should include unbroken markdown links for all recommendations."""
        Lesson.objects.create(
            slug="special-lesson-[1]",
            title="Lesson [Draft] 1: Intro to C++",
            summary="Introductory C++ course with [tags]",
            order=1,
        )

        context = WeeklyDigestService.get_user_digest_context(self.user)
        md = context.get("markdown_summary", "")

        self.assertIn(r"[Lesson \[Draft\] 1: Intro to C++]", md)
        self.assertIn("https://atelier.dev/lessons/special-lesson-%5B1%5D", md)
        self.assertIn("# Weekly Progress Summary for coder_sam", md)
