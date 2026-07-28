from django.apps import AppConfig


class SandboxConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sandbox"

    def ready(self):
        import logging

        logger = logging.getLogger(__name__)

        try:
            from django_q.models import Schedule

            Schedule.objects.get_or_create(
                name="cleanup-stale-sandbox-sessions",
                defaults={
                    "func": "apps.sandbox.tasks.cleanup_stale_sandbox_sessions",
                    "schedule_type": Schedule.MINUTES,
                    "minutes": 30,
                },
            )
        except Exception as e:
            logger.warning("Caught exception during schedule registration: %s", e)
            pass
