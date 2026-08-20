from django.urls import path

from .consumers import JWTTokenRotationConsumer

websocket_urlpatterns = [
    path("ws/auth/session/", JWTTokenRotationConsumer.as_asgi()),
]
