from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SearchAnalyticsViewSet,
    SearchEmbeddingViewSet,
    UserSearchProfileViewSet,
)

router = DefaultRouter()
router.register(r"search-embedding", SearchEmbeddingViewSet, basename="search-embedding")
router.register(r"user-search-profile", UserSearchProfileViewSet, basename="user-search-profile")
router.register(r"search-analytics", SearchAnalyticsViewSet, basename="search-analytics")

urlpatterns = [
    path("", include(router.urls)),
]
