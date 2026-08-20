from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CodeIssueViewSet,
    PRImpactAnalysisViewSet,
    PRReviewCommentViewSet,
    PRReviewViewSet,
    ReviewConfigViewSet,
)

router = DefaultRouter()
router.register(r"pr-review", PRReviewViewSet, basename="pr-review")
router.register(r"code-issue", CodeIssueViewSet, basename="code-issue")
router.register(r"pr-review-comment", PRReviewCommentViewSet, basename="pr-review-comment")
router.register(r"review-config", ReviewConfigViewSet, basename="review-config")
router.register(r"impact-analysis", PRImpactAnalysisViewSet, basename="impact-analysis")

urlpatterns = [
    path("", include(router.urls)),
]
