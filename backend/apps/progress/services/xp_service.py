import logging

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.progress.models import Badge, UserBadge, XPEvent

logger = logging.getLogger(__name__)


class XPService:
    """Service methods for awarding XP and badges."""

    @staticmethod
    @transaction.atomic
    def claim_multi_tier_rewards(user, tiers):
        """
        Award XP and/or a badge for every tier of a multi-stage challenge claim.

        `tiers` is a list of dicts, e.g.:
            [{"xp": 50, "badge_slug": "python-novice", "source_id": 12}, ...]

        The whole loop runs inside one atomic transaction block, so if any
        tier fails partway through, every XPEvent/UserBadge change made
        earlier in this same claim is rolled back instead of being left
        half-applied.
        """
        try:
            awarded_events = []
            awarded_badges = []

            for tier in tiers:
                xp_amount = tier.get("xp", 0)
                if xp_amount:
                    event = XPEvent.objects.create(
                        user=user,
                        source_type="milestone",
                        source_id=tier.get("source_id"),
                        base_points=xp_amount,
                        multiplier=1.0,
                        xp_delta=xp_amount,
                    )
                    awarded_events.append(event)

                badge_slug = tier.get("badge_slug")
                if badge_slug:
                    badge = Badge.objects.get(slug=badge_slug)
                    user_badge, _ = UserBadge.objects.get_or_create(
                        user=user, badge=badge
                    )
                    awarded_badges.append(user_badge)

            return {"xp_events": awarded_events, "badges": awarded_badges}

        except Exception as exc:
            logger.exception(
                "Multi-tier reward claim failed for user id=%s: %s",
                getattr(user, "id", None),
                exc,
            )
            raise ValidationError(
                "Failed to process reward claim. All changes have been rolled back."
            )
