from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExperimentAssignmentViewSet,
    ExperimentEventViewSet,
    ExperimentViewSet,
)

router = DefaultRouter()
router.register(r"experiment", ExperimentViewSet)
router.register(r"experiment-assignment", ExperimentAssignmentViewSet)
router.register(r"experiment-event", ExperimentEventViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
