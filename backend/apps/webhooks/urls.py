from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TestWebhookView, WebhookDeliveryViewSet, WebhookEndpointViewSet

router = DefaultRouter()
router.register(r"endpoints", WebhookEndpointViewSet, basename="webhook-endpoint")
router.register(r"deliveries", WebhookDeliveryViewSet, basename="webhook-delivery")

urlpatterns = [
    path("test", TestWebhookView.as_view(), name="webhook-test-direct"),
    path("test/", TestWebhookView.as_view(), name="webhook-test-direct-slash"),
    path("", include(router.urls)),
]
