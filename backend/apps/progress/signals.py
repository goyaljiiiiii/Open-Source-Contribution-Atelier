import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import LessonProgress, PeerReview, QuizAttempt, DailyTaskRecord
from django.utils import timezone

logger = logging.getLogger(__name__)


@receiver(post_save, sender=LessonProgress)
def on_lesson_completed(sender, instance, created, **kwargs):
    """
    Signal receiver that fires when a LessonProgress record is saved.

    Broadcasts a leaderboard_update only on a *first-time* completion
    transition (created-and-completed, or flipped from incomplete to complete)
    to prevent duplicate broadcasts when an already-completed record is
    re-saved for unrelated reasons.
    """
    # Only broadcast on a genuine completion transition.
    # `created` covers the case where the record is inserted as completed.
    # For updates we check the previous DB value via update_fields / pre-save.
    if not instance.completed:
        return

    if not created:
        if getattr(instance, "_original_completed", False):
            # It was already completed before this save!
            return

    # Update daily tasks
    update_daily_task(instance.user, "lesson")

    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("No channel layer configured; skipping leaderboard broadcast.")
        return

    try:
        from apps.progress.models import LessonProgress as LP
        from django.db.models import Sum

        total_xp = (
            LP.objects.filter(user=instance.user).aggregate(total=Sum("score"))["total"]
            or 0
        )
        async_to_sync(channel_layer.group_send)(
            "leaderboard",
            {
                "type": "leaderboard_update",
                "event": "xp_update",
                "user_id": instance.user.id,
                "username": instance.user.username,
                "xp": total_xp,
                "message": f"User {instance.user.username} completed lesson {instance.lesson.title}",
            },
        )
        logger.info(
            "Pushed leaderboard update for user %s completing lesson %s",
            instance.user.username,
            instance.lesson.title,
        )
    except Exception as exc:
        logger.error("Failed to push leaderboard update: %s", exc)

@receiver(post_save, sender=PeerReview)
def on_peer_review_created(sender, instance, created, **kwargs):
    if created:
        update_daily_task(instance.reviewer, "pr")

@receiver(post_save, sender=QuizAttempt)
def on_quiz_attempt_created(sender, instance, created, **kwargs):
    if created and instance.is_correct:
        update_daily_task(instance.user, "quiz")

def update_daily_task(user, task_type):
    today = timezone.localdate()
    record, _ = DailyTaskRecord.objects.get_or_create(user=user, date=today)
    
    updated = False
    new_xp = 0
    
    if task_type == "lesson":
        record.lessons_completed += 1
        if record.lessons_completed >= 2 and not record.lessons_awarded:
            record.lessons_awarded = True
            record.xp_earned += 20
            new_xp = 20
            updated = True
    elif task_type == "pr":
        record.prs_reviewed += 1
        if record.prs_reviewed >= 1 and not record.prs_awarded:
            record.prs_awarded = True
            record.xp_earned += 15
            new_xp = 15
            updated = True
    elif task_type == "quiz":
        record.quizzes_passed += 1
        if record.quizzes_passed >= 1 and not record.quizzes_awarded:
            record.quizzes_awarded = True
            record.xp_earned += 10
            new_xp = 10
            updated = True
            
    record.save()
    
    if updated:
        # Broadcast XP update for the user
        channel_layer = get_channel_layer()
        if channel_layer:
            from django.db.models import Sum
            from apps.progress.models import LessonProgress as LP
            from apps.dashboard.models import Issue
            
            # Recalculate total XP including daily tasks
            lesson_xp = LP.objects.filter(user=user).aggregate(total=Sum("score"))["total"] or 0
            issues_agg = Issue.objects.filter(assigned_to=user, status=Issue.Status.SOLVED).aggregate(
                p_sum=Sum("points"), b_sum=Sum("bonus_points")
            )
            issues_xp = (issues_agg["p_sum"] or 0) + (issues_agg["b_sum"] or 0)
            daily_xp = DailyTaskRecord.objects.filter(user=user).aggregate(total=Sum("xp_earned"))["total"] or 0
            
            total_xp = lesson_xp + issues_xp + daily_xp
            
            async_to_sync(channel_layer.group_send)(
                "leaderboard",
                {
                    "type": "leaderboard_update",
                    "event": "xp_update",
                    "user_id": user.id,
                    "username": user.username,
                    "xp": total_xp,
                    "message": f"User {user.username} earned {new_xp} bonus XP from a daily task!",
                },
            )

