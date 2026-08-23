"""
Celery tasks for burnout detection.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.burnout_detection.models import (
    BurnoutActivityDay,
    BurnoutSignal,
    ContributorActivity,
    Intervention,
)
from apps.burnout_detection.services.burnout_detector import BurnoutDetector
from apps.burnout_detection.services.sentiment_analyzer import SentimentAnalyzer

logger = logging.getLogger(__name__)

HIGH_ACTIVITY_HOURS = 8.0
HIGH_ACTIVITY_STREAK_DAYS = 5
ROLLING_WINDOW_DAYS = 7


def _is_high_activity_day(day, weekend_learning_enabled: bool) -> bool:
    """Return whether a day should count toward the sustained high-activity streak."""
    if day.date.weekday() >= 5 and not weekend_learning_enabled:
        return False
    return day.active_hours >= HIGH_ACTIVITY_HOURS


def _has_sustained_high_activity(days, weekend_learning_enabled: bool) -> bool:
    """Require five consecutive high-activity days before flagging burnout risk."""
    streak = 0
    previous_date = None

    for day in sorted(days, key=lambda item: item.date):
        if not _is_high_activity_day(day, weekend_learning_enabled):
            streak = 0
            previous_date = day.date
            continue

        if previous_date is not None and day.date != previous_date + timedelta(days=1):
            streak = 0

        streak += 1
        if streak >= HIGH_ACTIVITY_STREAK_DAYS:
            return True
        previous_date = day.date

    return False


@shared_task
def detect_user_burnout_risk():
    """Flag users with five consecutive high-duration study days in a 7-day window."""
    User = get_user_model()
    window_start = timezone.localdate() - timedelta(days=ROLLING_WINDOW_DAYS - 1)
    flagged_count = 0

    for user in User.objects.select_related("user_profile").all():
        profile = getattr(user, "user_profile", None)
        weekend_learning_enabled = bool(
            profile and getattr(profile, "weekend_learning_enabled", False)
        )
        days = BurnoutActivityDay.objects.filter(
            user=user, date__gte=window_start, date__lte=timezone.localdate()
        )

        if not _has_sustained_high_activity(days, weekend_learning_enabled):
            continue

        signal, created = BurnoutSignal.objects.get_or_create(
            user=user,
            signal_type="irregular_pattern",
            is_resolved=False,
            defaults={
                "severity": "severe",
                "description": (
                    "Sustained high-duration learning activity detected for "
                    f"at least {HIGH_ACTIVITY_STREAK_DAYS} consecutive days."
                ),
            },
        )
        if created:
            flagged_count += 1
            trigger_intervention.delay(user.id)

    logger.info("Detected %s sustained high-activity burnout cases", flagged_count)
    return {"flagged": flagged_count}


@shared_task
def detect_burnout():
    """
    Detect burnout in all contributors.
    """
    logger.info("Starting burnout detection")

    activities = ContributorActivity.objects.all()
    detector = BurnoutDetector()

    detected_count = 0
    critical_count = 0

    for activity in activities:
        try:
            result = detector.detect_burnout(activity)

            if result["needs_intervention"]:
                detected_count += 1
                if result["risk_level"] == "critical":
                    critical_count += 1

                for signal_data in result["signals"]:
                    BurnoutSignal.objects.create(
                        user=activity.user,
                        signal_type=signal_data["type"],
                        severity=signal_data["severity"],
                        description=signal_data["description"],
                    )

                trigger_intervention.delay(activity.user.id)

        except Exception as e:
            logger.error(f"Error detecting burnout for {activity.user.username}: {e}")

    logger.info(f"Detected {detected_count} burnout cases ({critical_count} critical)")
    return {"detected": detected_count, "critical": critical_count}


@shared_task
def trigger_intervention(user_id: int):
    """
    Trigger intervention for a user.
    """
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
        signal = BurnoutSignal.objects.filter(user=user, is_resolved=False).first()

        if not signal:
            return

        intervention_type = "encouragement"
        message = (
            "We've noticed you've been working hard. Take a break and recharge! 💪"
        )

        if signal.signal_type == "declining_activity":
            intervention_type = "encouragement"
            message = (
                "Your contributions matter! Is there anything we can help with? 🌟"
            )
        elif signal.signal_type == "negative_sentiment":
            intervention_type = "support_offer"
            message = "We appreciate your work. Open source is a team effort - we're here to support you! 🤝"
        elif signal.signal_type == "increased_response_time":
            intervention_type = "workload_reduction"
            message = "We can help distribute the workload. Let's chat about how we can make things easier! 💬"

        Intervention.objects.create(
            user=user,
            signal=signal,
            intervention_type=intervention_type,
            message=message,
            status="pending",
        )

        logger.info(f"Intervention triggered for {user.username}")

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
