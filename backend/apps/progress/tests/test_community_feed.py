from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.content.models import Exercise, Lesson
from apps.organizations.models import Organization
from apps.progress.models import (
    Badge,
    CodeSubmission,
    HelpRequest,
    LessonProgress,
    UserBadge,
)

User = get_user_model()


class TestCommunityFeedView(APITestCase):
    def setUp(self):
        self.org1 = Organization.objects.create(name="Org One")
        self.org2 = Organization.objects.create(name="Org Two")

        self.user_org1 = User.objects.create_user(
            username="feed_user_org1",
            email="feed_org1@example.com",
            password="password123",
        )
        profile1 = UserProfile.objects.get(user=self.user_org1)
        profile1.organization = self.org1
        profile1.save()

        self.user_org2 = User.objects.create_user(
            username="feed_user_org2",
            email="feed_org2@example.com",
            password="password123",
        )
        profile2 = UserProfile.objects.get(user=self.user_org2)
        profile2.organization = self.org2
        profile2.save()

        self.user_global = User.objects.create_user(
            username="feed_user_global",
            email="feed_global@example.com",
            password="password123",
        )

        self.lesson = Lesson.objects.create(
            title="Git Rebase Fundamentals",
            slug="git-rebase-fundamentals",
            content="Learn interactive rebasing",
        )

        self.exercise = Exercise.objects.create(
            lesson=self.lesson,
            title="Interactive Rebase Challenge",
            instructions="Rebase 3 commits",
        )

        self.badge = Badge.objects.create(
            name="Git Master",
            slug="git-master",
            description="Completed all Git modules",
        )

    def test_unauthenticated_request_returns_401(self):
        """Requests without authentication must return HTTP 401 Unauthorized."""
        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_empty_feed_returns_valid_pagination_envelope(self):
        """When no activity exists, return HTTP 200 with an empty results list envelope."""
        self.client.force_authenticate(user=self.user_global)
        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn("count", data)
        self.assertIn("next", data)
        self.assertIn("previous", data)
        self.assertIn("results", data)
        self.assertEqual(data["count"], 0)
        self.assertIsNone(data["next"])
        self.assertIsNone(data["previous"])
        self.assertEqual(data["results"], [])

    def test_feed_merges_all_four_activity_types(self):
        """Feed includes help_request, code_submission, badge_earned, and lesson_completed."""
        self.client.force_authenticate(user=self.user_global)

        # 1. Help request
        hr = HelpRequest.objects.create(
            user=self.user_global,
            lesson=self.lesson,
            message="How do I squash commits?",
        )

        # 2. Code submission
        cs = CodeSubmission.objects.create(
            user=self.user_global,
            exercise=self.exercise,
            title="My Rebase Solution",
            description="Squashed fixup commits into main feature",
            code_snippet="git rebase -i HEAD~3",
        )

        # 3. Badge earned
        ub = UserBadge.objects.create(
            user=self.user_global,
            badge=self.badge,
        )

        # 4. Lesson completed
        lp = LessonProgress.objects.create(
            user=self.user_global,
            lesson=self.lesson,
            completed=True,
            score=100,
        )

        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["count"], 4)
        results = data["results"]
        self.assertEqual(len(results), 4)

        activity_types = {item["type"] for item in results}
        expected_types = {
            "help_request",
            "code_submission",
            "badge_earned",
            "lesson_completed",
        }
        self.assertEqual(activity_types, expected_types)

        # Verify entry structure for each type
        hr_item = next(i for i in results if i["type"] == "help_request")
        self.assertEqual(hr_item["id"], f"hr_{hr.id}")
        self.assertEqual(hr_item["user_id"], self.user_global.id)
        self.assertEqual(hr_item["username"], self.user_global.username)
        self.assertIn("Git Rebase Fundamentals", hr_item["title"])
        self.assertEqual(hr_item["description"], "How do I squash commits?")

        cs_item = next(i for i in results if i["type"] == "code_submission")
        self.assertEqual(cs_item["id"], f"cs_{cs.id}")
        self.assertIn("My Rebase Solution", cs_item["title"])

        ub_item = next(i for i in results if i["type"] == "badge_earned")
        self.assertEqual(ub_item["id"], f"bd_{ub.id}")
        self.assertIn("Git Master", ub_item["title"])

        lp_item = next(i for i in results if i["type"] == "lesson_completed")
        self.assertEqual(lp_item["id"], f"lp_{lp.id}")
        self.assertIn("Git Rebase Fundamentals", lp_item["title"])
        self.assertEqual(lp_item["description"], "Scored 100 points")

    def test_global_ordering_newest_first_across_types(self):
        """Merged feed entries must be ordered by created_at descending."""
        self.client.force_authenticate(user=self.user_global)
        now = timezone.now()

        # Create activities with explicit timestamps
        hr = HelpRequest.objects.create(
            user=self.user_global,
            lesson=self.lesson,
            message="Oldest help request",
        )
        HelpRequest.objects.filter(id=hr.id).update(created_at=now - timedelta(hours=4))

        cs = CodeSubmission.objects.create(
            user=self.user_global,
            exercise=self.exercise,
            title="Second oldest submission",
        )
        CodeSubmission.objects.filter(id=cs.id).update(created_at=now - timedelta(hours=3))

        ub = UserBadge.objects.create(
            user=self.user_global,
            badge=self.badge,
        )
        UserBadge.objects.filter(id=ub.id).update(earned_at=now - timedelta(hours=2))

        lp = LessonProgress.objects.create(
            user=self.user_global,
            lesson=self.lesson,
            completed=True,
            score=95,
        )
        LessonProgress.objects.filter(id=lp.id).update(updated_at=now - timedelta(hours=1))

        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data["results"]
        self.assertEqual(len(results), 4)

        # Expected order: lp (1h ago), ub (2h ago), cs (3h ago), hr (4h ago)
        self.assertEqual(results[0]["id"], f"lp_{lp.id}")
        self.assertEqual(results[1]["id"], f"bd_{ub.id}")
        self.assertEqual(results[2]["id"], f"cs_{cs.id}")
        self.assertEqual(results[3]["id"], f"hr_{hr.id}")

        created_ats = [item["created_at"] for item in results]
        self.assertEqual(created_ats, sorted(created_ats, reverse=True))

    def test_pagination_envelope_and_pages(self):
        """PageNumberPagination returns 20 items per page with proper next/count fields."""
        self.client.force_authenticate(user=self.user_global)

        # Create 25 help requests
        for i in range(25):
            HelpRequest.objects.create(
                user=self.user_global,
                lesson=self.lesson,
                message=f"Pagination request {i}",
            )

        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["count"], 25)
        self.assertEqual(len(data["results"]), 20)
        self.assertIsNotNone(data["next"])
        self.assertIn("page=2", data["next"])

        # Fetch page 2
        page2_response = self.client.get("/api/progress/community-feed/?page=2")
        self.assertEqual(page2_response.status_code, status.HTTP_200_OK)

        page2_data = page2_response.data
        self.assertEqual(page2_data["count"], 25)
        self.assertEqual(len(page2_data["results"]), 5)
        self.assertIsNone(page2_data["next"])

    def test_behavior_when_some_types_have_zero_items(self):
        """Feed handles zero items in one or more querysets gracefully."""
        self.client.force_authenticate(user=self.user_global)

        # Create only CodeSubmission items (0 HelpRequest, 0 UserBadge, 0 LessonProgress)
        for i in range(3):
            CodeSubmission.objects.create(
                user=self.user_global,
                exercise=self.exercise,
                title=f"Submission {i}",
            )

        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["count"], 3)
        self.assertTrue(all(item["type"] == "code_submission" for item in data["results"]))

    def test_organization_scoped_feed(self):
        """Users in an organization see only activity from users in their organization."""
        # Create HelpRequest for user in Org 1
        hr_org1 = HelpRequest.objects.create(
            user=self.user_org1,
            lesson=self.lesson,
            message="Help for Org 1",
        )
        # Create HelpRequest for user in Org 2
        HelpRequest.objects.create(
            user=self.user_org2,
            lesson=self.lesson,
            message="Help for Org 2",
        )

        # Authenticate as user in Org 1
        self.client.force_authenticate(user=self.user_org1)
        response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["id"], f"hr_{hr_org1.id}")
        self.assertEqual(data["results"][0]["username"], self.user_org1.username)

        # Authenticate as user without org (global feed view)
        self.client.force_authenticate(user=self.user_global)
        global_response = self.client.get("/api/progress/community-feed/")
        self.assertEqual(global_response.status_code, status.HTTP_200_OK)
        self.assertEqual(global_response.data["count"], 2)

    def test_per_type_200_item_cap(self):
        """Querysets are capped at 200 items per type."""
        self.client.force_authenticate(user=self.user_global)

        # Create 205 HelpRequests
        help_requests = [
            HelpRequest(
                user=self.user_global,
                lesson=self.lesson,
                message=f"Request {i}",
            )
            for i in range(205)
        ]
        HelpRequest.objects.bulk_create(help_requests)

        response = self.client.get("/api/progress/community-feed/?page_size=50")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Total count in the paginated response should reflect the capped 200 items
        self.assertEqual(response.data["count"], 200)
