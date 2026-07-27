from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IssueQualityViewSet

router = DefaultRouter()
router.register(r"issue-quality", IssueQualityViewSet, basename="issue-quality")

urlpatterns = [
    path("", include(router.urls)),
]
