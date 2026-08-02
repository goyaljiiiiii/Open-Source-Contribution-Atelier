from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IssueViewSet, ModelViewSet

router = DefaultRouter()
router.register(r"issue", IssueViewSet, basename="ml-issue")
router.register(r"model", ModelViewSet, basename="model")

urlpatterns = [
    path("", include(router.urls)),
]
