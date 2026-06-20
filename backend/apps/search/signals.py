from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from apps.content.models import Lesson
from .tasks import index_model_for_search, remove_model_from_search

User = get_user_model()

# --- Lesson Indexing ---

@receiver(post_save, sender=Lesson)
def index_lesson(sender, instance, **kwargs):
    title = instance.title
    body_text = f"{instance.summary} {instance.content}"
    # Offload indexing to Celery worker
    index_model_for_search.delay(
        app_label=sender._meta.app_label,
        model_name=sender._meta.model_name,
        object_id=instance.pk,
        title=title,
        body_text=body_text
    )

@receiver(post_delete, sender=Lesson)
def remove_lesson_index(sender, instance, **kwargs):
    remove_model_from_search.delay(
        app_label=sender._meta.app_label,
        model_name=sender._meta.model_name,
        object_id=instance.pk
    )


# --- User Indexing ---

@receiver(post_save, sender=User)
def index_user(sender, instance, **kwargs):
    title = instance.username
    body_text = instance.email
    index_model_for_search.delay(
        app_label=sender._meta.app_label,
        model_name=sender._meta.model_name,
        object_id=instance.pk,
        title=title,
        body_text=body_text
    )

@receiver(post_delete, sender=User)
def remove_user_index(sender, instance, **kwargs):
    remove_model_from_search.delay(
        app_label=sender._meta.app_label,
        model_name=sender._meta.model_name,
        object_id=instance.pk
    )
