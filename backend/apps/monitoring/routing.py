from django.urls import re_path

from apps.monitoring.consumers import CeleryMonitorConsumer

websocket_urlpatterns = [
    re_path(r"^ws/admin/celery/$", CeleryMonitorConsumer.as_asgi()),
]
