from django.apps import AppConfig


class ContentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.content"

    def ready(self):
        from django.utils.module_loading import autodiscover_modules

        import apps.content.signals  # noqa: F401

        autodiscover_modules("lesson_plugins")
