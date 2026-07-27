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
