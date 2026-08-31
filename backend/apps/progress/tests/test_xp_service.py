from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.progress.models import Badge, UserBadge, XPEvent
from apps.progress.services.xp_service import XPService

User = get_user_model()


@pytest.mark.django_db
class TestXPServiceMultiTierClaim(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="xp_claim_user", email="xp_claim@example.com", password="password"
        )
        self.badge = Badge.objects.create(
            name="Challenge Champ", slug="challenge-champ", description="desc"
        )

    def test_claim_awards_xp_and_badge_for_every_tier(self):
        tiers = [
            {"xp": 20, "source_id": 1},
            {"xp": 30, "badge_slug": "challenge-champ", "source_id": 2},
        ]

        result = XPService.claim_multi_tier_rewards(self.user, tiers)

        self.assertEqual(len(result["xp_events"]), 2)
        self.assertEqual(len(result["badges"]), 1)
        self.assertEqual(XPEvent.objects.filter(user=self.user).count(), 2)
        self.assertEqual(UserBadge.objects.filter(user=self.user).count(), 1)

    def test_claim_rolls_back_all_changes_on_db_error(self):
        tiers = [
            {"xp": 20, "source_id": 1},
            {"xp": 30, "source_id": 2},
            {"xp": 40, "source_id": 3},
        ]

        # Simulate a DB error injected on the 3rd tier's XPEvent creation.
        original_create = XPEvent.objects.create
        call_count = {"n": 0}

        def flaky_create(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 3:
                raise DatabaseError("simulated DB failure")
            return original_create(*args, **kwargs)

        with patch.object(XPEvent.objects, "create", side_effect=flaky_create):
            with self.assertRaises(ValidationError):
                XPService.claim_multi_tier_rewards(self.user, tiers)

        # Nothing from the failed claim should have been persisted.
        self.assertEqual(XPEvent.objects.filter(user=self.user).count(), 0)

    def test_claim_rolls_back_badge_when_later_tier_fails(self):
        tiers = [
            {"xp": 10, "badge_slug": "challenge-champ", "source_id": 1},
            {"xp": 15, "source_id": 2},
        ]

        original_create = XPEvent.objects.create
        call_count = {"n": 0}

        def flaky_create(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 2:
                raise DatabaseError("simulated DB failure")
            return original_create(*args, **kwargs)

        with patch.object(XPEvent.objects, "create", side_effect=flaky_create):
            with self.assertRaises(ValidationError):
                XPService.claim_multi_tier_rewards(self.user, tiers)

        self.assertEqual(XPEvent.objects.filter(user=self.user).count(), 0)
        self.assertEqual(UserBadge.objects.filter(user=self.user).count(), 0)

    def test_claim_logs_exception_on_failure(self):
        tiers = [{"xp": 10, "source_id": 1}]

        with patch.object(
            XPEvent.objects, "create", side_effect=DatabaseError("simulated DB failure")
        ):
            with self.assertLogs(
                "apps.progress.services.xp_service", level="ERROR"
            ) as cm:
                with self.assertRaises(ValidationError):
                    XPService.claim_multi_tier_rewards(self.user, tiers)

        self.assertTrue(
            any("Multi-tier reward claim failed" in log for log in cm.output)
        )
