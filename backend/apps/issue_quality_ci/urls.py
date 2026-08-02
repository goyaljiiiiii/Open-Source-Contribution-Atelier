from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    IssueQualityRecordViewSet,
    QualityCommentViewSet,
    QualityMetricViewSet,
    QualityTrendViewSet,
)

router = DefaultRouter()
router.register(r"issue-quality-record", IssueQualityRecordViewSet)
router.register(r"quality-metric", QualityMetricViewSet)
router.register(r"quality-comment", QualityCommentViewSet)
router.register(r"quality-trend", QualityTrendViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
