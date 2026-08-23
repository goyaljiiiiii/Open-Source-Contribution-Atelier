from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IssueViewSet, ModelViewSet, ml_triage_threshold

router = DefaultRouter()
router.register(r"issue", IssueViewSet, basename="ml-issue")
router.register(r"model", ModelViewSet, basename="model")

urlpatterns = [
    path("settings/threshold/", ml_triage_threshold, name="ml-triage-threshold"),
    path("", include(router.urls)),
]
