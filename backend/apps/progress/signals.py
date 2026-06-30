import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction

from .models import LessonProgress, ExerciseAttempt

logger = logging.getLogger(__name__)


@receiver(post_save, sender=LessonProgress)
def on_lesson_completed(sender, instance, created, **kwargs):
    if not instance.completed:
        return

    if not created:
        try:
            previous = LessonProgress.objects.only("completed").get(pk=instance.pk)
            update_fields = kwargs.get("update_fields")
            if update_fields is not None and "completed" not in update_fields:
                return
        except LessonProgress.DoesNotExist:
            pass

    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning("No channel layer configured; skipping leaderboard broadcast.")
        return

    try:
        from django.db.models import Sum

        from apps.progress.models import LessonProgress as LP

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

    # Evaluate achievements on lesson completion - Wrapped in on_commit to prevent mid-transaction evaluation
    try:
        from apps.progress.tasks import evaluate_achievements_task

        transaction.on_commit(
            lambda: evaluate_achievements_task.delay(instance.user.id)
        )
    except Exception as exc:
        logger.error("Failed to enqueue achievement evaluation: %s", exc)


@receiver(post_save, sender=ExerciseAttempt)
def on_exercise_attempt(sender, instance, created, **kwargs):
    if instance.is_correct:
        try:
            from apps.progress.tasks import evaluate_achievements_task

            transaction.on_commit(
                lambda: evaluate_achievements_task.delay(instance.user.id)
            )
        except Exception as exc:
            logger.error("Failed to enqueue achievement evaluation: %s", exc)
