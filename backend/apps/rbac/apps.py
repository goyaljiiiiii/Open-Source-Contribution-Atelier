from django.apps import AppConfig


class RbacConfig(AppConfig):
    name = "apps.rbac"

    def ready(self):
        import apps.rbac.signals
