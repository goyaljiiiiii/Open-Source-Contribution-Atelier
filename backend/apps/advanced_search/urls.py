from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SearchAnalyticsViewSet,
    SearchEmbeddingViewSet,
    UserSearchProfileViewSet,
)

router = DefaultRouter()
router.register(r"search-embedding", SearchEmbeddingViewSet)
router.register(r"user-search-profile", UserSearchProfileViewSet)
router.register(r"search-analytics", SearchAnalyticsViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
