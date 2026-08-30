from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.errors.views import ErrorEventViewSet, ErrorGroupViewSet, ErrorIngestView

router = DefaultRouter()
router.register(r"groups", ErrorGroupViewSet, basename="error-groups")
router.register(r"events", ErrorEventViewSet, basename="error-events")

urlpatterns = [
    path("ingest/", ErrorIngestView.as_view(), name="error-ingest"),
    path("", include(router.urls)),
]
