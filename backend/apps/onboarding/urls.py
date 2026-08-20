from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    JourneyEventViewSet,
    OnboardingJourneyViewSet,
    OnboardingMetricViewSet,
    OnboardingNudgeViewSet,
)

router = DefaultRouter()
router.register(r"onboarding-journey", OnboardingJourneyViewSet, basename="onboarding-journey")
router.register(r"journey-event", JourneyEventViewSet, basename="journey-event")
router.register(r"onboarding-nudge", OnboardingNudgeViewSet, basename="onboarding-nudge")
router.register(r"onboarding-metric", OnboardingMetricViewSet, basename="onboarding-metric")

urlpatterns = [
    path("", include(router.urls)),
]
