from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BurnoutMetricViewSet,
    BurnoutSignalViewSet,
    ContributorActivityViewSet,
    InterventionViewSet,
)

router = DefaultRouter()
router.register(r"contributor-activity", ContributorActivityViewSet)
router.register(r"burnout-signal", BurnoutSignalViewSet)
router.register(r"intervention", InterventionViewSet)
router.register(r"burnout-metric", BurnoutMetricViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
