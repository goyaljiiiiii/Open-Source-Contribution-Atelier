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
router.register(r"feature-request", FeatureRequestViewSet)
router.register(r"vote", VoteViewSet)
router.register(r"comment", CommentViewSet)
router.register(r"status-history", StatusHistoryViewSet)
router.register(r"roadmap-milestone", RoadmapMilestoneViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
