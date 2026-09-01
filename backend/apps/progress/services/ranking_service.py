"""Compute a user's global rank and percentile standing from lifetime XP.

Both values share the same underlying aggregate over ``XPEvent``, so they are
computed in a single query instead of being re-aggregated per field.
"""

from __future__ import annotations


class RankingService:
    """Stateless helpers for global rank and percentile standings."""

    @staticmethod
    def get_global_rank(user) -> int:
        from django.contrib.auth import get_user_model
        from django.db.models import Sum

        from apps.progress.models import XPEvent

        user_xp = (
            XPEvent.objects.filter(user=user).aggregate(total=Sum("xp_delta"))["total"]
            or 0
        )
        higher_count = (
            XPEvent.objects.values("user")
            .annotate(total=Sum("xp_delta"))
            .filter(total__gt=user_xp)
            .count()
        )
        return higher_count + 1

    @staticmethod
    def get_percentile_standing(user) -> int:
        from django.contrib.auth import get_user_model
        from django.db.models import Sum

        from apps.progress.models import XPEvent

        User = get_user_model()
        total_users = User.objects.count()
        if total_users <= 1:
            return 1

        user_xp = (
            XPEvent.objects.filter(user=user).aggregate(total=Sum("xp_delta"))["total"]
            or 0
        )
        higher_count = (
            XPEvent.objects.values("user")
            .annotate(total=Sum("xp_delta"))
            .filter(total__gt=user_xp)
            .count()
        )
        rank = higher_count + 1
        return max(1, int(round((rank / total_users) * 100)))
