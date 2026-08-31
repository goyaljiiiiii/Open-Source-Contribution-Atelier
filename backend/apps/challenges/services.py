"""Challenge domain services.

Keeps the XP-calculation logic used when a user completes the "Challenge of
the Day" in one place so the view stays thin and the behaviour is unit-testable
without a database with the pure helper.
"""

from apps.progress.models import StreakProfile

# Streak multipliers applied to the base daily challenge XP when the user has
# an active streak longer than STREAK_MULTIPLIER_THRESHOLD_DAYS.
STREAK_MULTIPLIER_THRESHOLD_DAYS = 5

# (min_streak_days, multiplier) tiers. A user on a streak strictly longer than
# the threshold receives the multiplier of the highest tier they qualify for.
STREAK_XP_MULTIPLIER_TIERS = [
    (6, 1.2),
    (14, 1.3),
    (30, 1.5),
]

BASE_MULTIPLIER = 1.0


def _streak_multiplier_for_days(streak_days: int) -> float:
    """Pure lookup of the challenge XP multiplier for a given streak length."""
    if streak_days <= STREAK_MULTIPLIER_THRESHOLD_DAYS:
        return BASE_MULTIPLIER

    multiplier = BASE_MULTIPLIER
    for threshold, ratio in STREAK_XP_MULTIPLIER_TIERS:
        if streak_days >= threshold:
            multiplier = ratio
    return multiplier


def calculate_daily_challenge_xp(
    user, base_xp: int, current_streak: int | None = None
) -> int:
    """Return the XP awarded for completing today's challenge.

    Multiplies ``base_xp`` by the streak multiplier that corresponds to the
    user's current active streak. ``current_streak`` may be passed explicitly
    to avoid an extra query; otherwise it is read from the user's
    ``StreakProfile``.
    """
    if current_streak is None:
        profile = StreakProfile.objects.filter(user=user).first()
        current_streak = profile.current_streak if profile else 0

    multiplier = _streak_multiplier_for_days(current_streak)
    return int(round(base_xp * multiplier))
