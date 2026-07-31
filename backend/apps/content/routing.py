from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r"^ws/lesson-editor/(?P<slug>[^/]+)/?$",
        consumers.LessonEditorConsumer.as_asgi(),
    ),
]
