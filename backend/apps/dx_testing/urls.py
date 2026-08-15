from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DXTestRunViewSet

router = DefaultRouter()
router.register(r"dx-test-run", DXTestRunViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
