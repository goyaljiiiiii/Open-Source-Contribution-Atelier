import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.webhooks.tasks import dispatch_event

logger = logging.getLogger(__name__)


# 1. Lesson Completed
@receiver(post_save, sender="progress.LessonProgress")
def webhook_on_lesson_completed(sender, instance, created, **kwargs):
    if not instance.completed:
        return
    try:
        payload = {
            "user_id": instance.user_id,
            "username": instance.user.username,
            "lesson_slug": instance.lesson.slug if hasattr(instance, "lesson") and instance.lesson else getattr(instance, "lesson_id", None),
            "lesson_title": instance.lesson.title if hasattr(instance, "lesson") and instance.lesson else str(getattr(instance, "lesson_id", "")),
            "score": getattr(instance, "score", 0),
            "completed_at": instance.completed_at.isoformat() if getattr(instance, "completed_at", None) else None,
        }
        dispatch_event("lesson.completed", payload)
    except Exception as exc:
        logger.error("Failed to dispatch lesson.completed webhook: %s", exc)


# 2. Badge Awarded
@receiver(post_save, sender="progress.UserBadge")
def webhook_on_badge_awarded(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        payload = {
            "user_id": instance.user_id,
            "username": instance.user.username,
            "badge_id": instance.badge_id,
            "badge_name": instance.badge.name if hasattr(instance, "badge") and instance.badge else str(instance.badge_id),
            "earned_at": instance.earned_at.isoformat() if getattr(instance, "earned_at", None) else None,
        }
        dispatch_event("badge.awarded", payload)
    except Exception as exc:
        logger.error("Failed to dispatch badge.awarded webhook: %s", exc)


# 3. XP Milestone Reached
@receiver(post_save, sender="progress.XPEvent")
def webhook_on_xp_milestone(sender, instance, created, **kwargs):
    if not created or instance.xp_delta <= 0:
        return
    try:
        payload = {
            "user_id": instance.user_id,
            "username": instance.user.username,
            "xp_delta": instance.xp_delta,
            "source_type": instance.source_type,
            "description": instance.description,
            "created_at": instance.created_at.isoformat() if getattr(instance, "created_at", None) else None,
        }
        dispatch_event("xp.milestone", payload)
    except Exception as exc:
        logger.error("Failed to dispatch xp.milestone webhook: %s", exc)


# 4. User Leveled Up
@receiver(post_save, sender="accounts.UserProfile")
def webhook_on_user_leveled_up(sender, instance, created, **kwargs):
    if created:
        return
    try:
        payload = {
            "user_id": instance.user_id,
            "username": instance.user.username,
            "level": getattr(instance, "level", 1),
            "xp": getattr(instance, "total_xp", getattr(instance, "xp", 0)),
        }
        dispatch_event("user.leveled_up", payload)
    except Exception as exc:
        logger.error("Failed to dispatch user.leveled_up webhook: %s", exc)


# 5. Issue Created
@receiver(post_save, sender="issues.Issue")
def webhook_on_issue_created(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        payload = {
            "issue_id": instance.id,
            "title": instance.title,
            "status": getattr(instance, "status", "open"),
            "author_id": getattr(instance, "author_id", None) or getattr(instance, "user_id", None),
            "author_username": instance.author.username if getattr(instance, "author", None) else getattr(instance, "user", None).username if getattr(instance, "user", None) else "anonymous",
            "created_at": instance.created_at.isoformat() if getattr(instance, "created_at", None) else None,
        }
        dispatch_event("issue.created", payload)
    except Exception as exc:
        logger.error("Failed to dispatch issue.created webhook: %s", exc)


# 6. PR Merged / Review Submitted
@receiver(post_save, sender="progress.CodeSubmission")
def webhook_on_pr_merged(sender, instance, created, **kwargs):
    if getattr(instance, "status", None) == "merged":
        try:
            payload = {
                "submission_id": instance.id,
                "user_id": instance.user_id,
                "username": instance.user.username,
                "status": instance.status,
                "lesson_slug": getattr(instance, "lesson_slug", ""),
            }
            dispatch_event("pr.merged", payload)
        except Exception as exc:
            logger.error("Failed to dispatch pr.merged webhook: %s", exc)
