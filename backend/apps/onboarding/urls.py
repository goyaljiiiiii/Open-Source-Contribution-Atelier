from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    JourneyEventViewSet,
    OnboardingJourneyViewSet,
    OnboardingMetricViewSet,
    OnboardingNudgeViewSet,
)

router = DefaultRouter()
router.register(r"onboarding-journey", OnboardingJourneyViewSet)
router.register(r"journey-event", JourneyEventViewSet)
router.register(r"onboarding-nudge", OnboardingNudgeViewSet)
router.register(r"onboarding-metric", OnboardingMetricViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
