from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SandboxVerifyView, CodeSnapshotViewSet, ProjectViewSet, ProjectFileViewSet

router = DefaultRouter()
router.register(r"snapshots", CodeSnapshotViewSet, basename="snapshot")
router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"files", ProjectFileViewSet, basename="projectfile")

urlpatterns = [
    path("verify/", SandboxVerifyView.as_view(), name="sandbox-verify"),
    path("", include(router.urls)),
]
