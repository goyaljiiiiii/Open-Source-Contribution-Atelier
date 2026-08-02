from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CategorySuggestionViewSet,
    CategoryViewSet,
    IssueCategoryAssignmentViewSet,
    IssueTagAssignmentViewSet,
    IssueTagViewSet,
)

router = DefaultRouter()
router.register(r"category", CategoryViewSet)
router.register(r"issue-category-assignment", IssueCategoryAssignmentViewSet)
router.register(r"issue-tag", IssueTagViewSet)
router.register(r"issue-tag-assignment", IssueTagAssignmentViewSet)
router.register(r"category-suggestion", CategorySuggestionViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
