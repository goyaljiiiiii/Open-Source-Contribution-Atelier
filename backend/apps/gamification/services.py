from datetime import timedelta

from django.utils import timezone

from .models import Streak


class StreakService:
    @staticmethod
    def update_streak(user):
        streak, created = Streak.objects.get_or_create(user=user)
        today = timezone.localdate()

        if streak.last_activity_date == today:
            return streak  # Already updated today

        if streak.last_activity_date == today - timedelta(days=1):
            streak.current_streak += 1
        else:
            streak.current_streak = 1

        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak

        streak.last_activity_date = today
        streak.save()
        return streak


def award_badge_service(user, badge_name="Bug Hunter"):
    """
    Awards a gamification Badge to a user if not already earned.
    Creates a UserAchievement record and returns (achievement, created).
    """
    from .models import Badge, UserAchievement

    if isinstance(badge_name, Badge):
        badge = badge_name
    else:
        badge, _ = Badge.objects.get_or_create(
            name=badge_name,
            defaults={"description": f"Awarded for obtaining {badge_name}."},
        )

    achievement, created = UserAchievement.objects.get_or_create(
        user=user,
        badge=badge,
    )
    return achievement, created

