from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FeedEventViewSet, FeedPostViewSet

router = DefaultRouter()
router.register(r"feed-event", FeedEventViewSet)
router.register(r"posts", FeedPostViewSet, basename="feed-post")

urlpatterns = [
    path("", include(router.urls)),
]
