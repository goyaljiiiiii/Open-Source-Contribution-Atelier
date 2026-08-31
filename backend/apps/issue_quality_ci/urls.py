from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    IssueQualityRecordViewSet,
    QualityCommentViewSet,
    QualityMetricViewSet,
    QualityTrendViewSet,
)

router = DefaultRouter()
router.register(
    r"issue-quality-record", IssueQualityRecordViewSet, basename="issue-quality-record"
)
router.register(r"quality-metric", QualityMetricViewSet, basename="quality-metric")
router.register(r"quality-comment", QualityCommentViewSet, basename="quality-comment")
router.register(r"quality-trend", QualityTrendViewSet, basename="quality-trend")

urlpatterns = [
    path("", include(router.urls)),
]
