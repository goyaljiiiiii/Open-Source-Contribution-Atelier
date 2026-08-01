import base64
import urllib.parse as parse

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.content.models import Lesson


class SecureCursorPaginationTests(APITestCase):
    def setUp(self):
        now = timezone.now()
        # Create 50 records with the exact same timestamp
        lessons = [
            Lesson(
                title=f"Lesson {i}",
                description=f"Desc {i}",
                content="test content",
                slug=f"lesson-{i}",
                created_at=now,
            )
            for i in range(50)
        ]
        # In SQLite, bulk_create doesn't return IDs, but when we query they are there.
        Lesson.objects.bulk_create(lessons)

        # Update the created_at to be exactly `now` for all just in case auto_now_add tries to override it.
        Lesson.objects.all().update(created_at=now)

    def test_concurrent_inserts_pagination(self):
        url = reverse("lesson-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        results = data["results"]
        self.assertEqual(len(results), 25)
        self.assertIsNotNone(data["next"])

        # Verify the custom fields are present
        self.assertIn("remaining", data)
        self.assertIn("total_estimate", data)
        self.assertEqual(data["total_estimate"], 50)
        self.assertEqual(data["remaining"], 25)

        # Fetch next page
        response2 = self.client.get(data["next"])
        self.assertEqual(response2.status_code, 200)

        data2 = response2.json()
        results2 = data2["results"]
        self.assertEqual(len(results2), 25)

        # We should be at the end
        self.assertIsNone(data2["next"])
        self.assertEqual(data2["remaining"], 0)

        # Ensure no duplicates between the two pages
        ids_page_1 = set(r["id"] for r in results)
        ids_page_2 = set(r["id"] for r in results2)

        self.assertEqual(len(ids_page_1.intersection(ids_page_2)), 0)

    def test_tampered_cursor_returns_400(self):
        url = reverse("lesson-list")
        response = self.client.get(url)
        data = response.json()
        next_url = data["next"]

        # Tamper with the cursor in the URL
        parsed = parse.urlparse(next_url)
        qs = parse.parse_qs(parsed.query)
        cursor = qs["cursor"][0]

        parts = cursor.split(".")
        tampered_cursor = parts[0] + ".badsignature12"

        qs["cursor"] = [tampered_cursor]
        tampered_url = parsed._replace(query=parse.urlencode(qs, doseq=True)).geturl()

        response2 = self.client.get(tampered_url)
        self.assertEqual(response2.status_code, 400)
        error_msg = response2.json()
        if isinstance(error_msg, list):
            self.assertIn(
                "Invalid cursor signature. Please re-request from page 1.", error_msg
            )
        else:
            self.assertIn(
                "Invalid cursor signature. Please re-request from page 1.",
                str(error_msg),
            )

    def test_old_format_cursor_returns_400(self):
        url = reverse("lesson-list")

        # Create a fake old cursor without signature
        lesson = Lesson.objects.first()
        payload = f"{lesson.created_at.timestamp()}|{lesson.id}"
        old_cursor = base64.urlsafe_b64encode(payload.encode("ascii")).decode("ascii")

        response = self.client.get(url, {"cursor": old_cursor})
        self.assertEqual(response.status_code, 400)

        error_msg = response.json()
        if isinstance(error_msg, list):
            self.assertIn(
                "Invalid cursor signature. Please re-request from page 1.", error_msg
            )
        else:
            self.assertIn(
                "Invalid cursor signature. Please re-request from page 1.",
                str(error_msg),
            )
