from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BurnoutMetricViewSet,
    BurnoutSignalViewSet,
    ContributorActivityViewSet,
    InterventionViewSet,
)

router = DefaultRouter()
router.register(
    r"contributor-activity", ContributorActivityViewSet, basename="contributor-activity"
)
router.register(r"burnout-signal", BurnoutSignalViewSet, basename="burnout-signal")
router.register(r"intervention", InterventionViewSet, basename="intervention")
router.register(r"burnout-metric", BurnoutMetricViewSet, basename="burnout-metric")

urlpatterns = [
    path("", include(router.urls)),
]
