from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import LessonViewSet, SearchView

router = DefaultRouter()
router.register("lessons", LessonViewSet, basename="lesson")

urlpatterns = router.urls + [
    path("search/", SearchView.as_view(), name="search"),
]

