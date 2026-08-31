from django.apps import AppConfig


class LearningAnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.learning_analytics"
    verbose_name = "Learning Analytics"
    ready = None  # Avoid early signal import issues in tests

    def ready(self):
        pass
