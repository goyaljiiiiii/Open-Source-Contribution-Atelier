from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CommentViewSet,
    FeatureRequestViewSet,
    RoadmapMilestoneViewSet,
    StatusHistoryViewSet,
    VoteViewSet,
)

router = DefaultRouter()
router.register(r"feature-request", FeatureRequestViewSet, basename="feature-request")
router.register(r"vote", VoteViewSet, basename="vote")
router.register(r"comment", CommentViewSet, basename="comment")
router.register(r"status-history", StatusHistoryViewSet, basename="status-history")
router.register(
    r"roadmap-milestone", RoadmapMilestoneViewSet, basename="roadmap-milestone"
)

urlpatterns = [
    path("", include(router.urls)),
]
