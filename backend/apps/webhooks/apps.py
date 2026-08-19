from django.apps import AppConfig


class WebhooksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.webhooks"

    def ready(self):
        try:
            import apps.webhooks.signals  # noqa
        except Exception:
            pass
