from django.apps import AppConfig


class SearchConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.search"

    def ready(self):
        try:
            import apps.search.handlers
            from apps.events.registry import EventHandlerRegistry

            EventHandlerRegistry.discover_handlers("apps.search.handlers")
        except ImportError:
            pass

        from django.db.models.signals import post_migrate

        import apps.search.checks  # noqa: F401

        post_migrate.connect(self.setup_schedules, sender=self)

    def setup_schedules(self, sender, **kwargs):
        import logging

        logger = logging.getLogger(__name__)
        try:
            from django_q.models import Schedule

            Schedule.objects.get_or_create(
                name="reconcile-search-index",
                defaults={
                    "func": "apps.search.tasks.reconcile_search_index",
                    "schedule_type": Schedule.MINUTES,
                    "minutes": 15,
                },
            )
        except Exception as exc:
            logger.warning("Caught exception setting up search schedule: %s", exc)
