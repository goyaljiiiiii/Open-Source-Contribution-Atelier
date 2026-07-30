from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/collab-notes/(?P<room_id>\w+)/$", consumers.CollabNotesConsumer.as_asgi()),
    re_path(r"ws/collab-notes/$", consumers.CollabNotesConsumer.as_asgi()),
]
