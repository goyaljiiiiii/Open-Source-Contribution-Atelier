from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import GeneratedPortfolioViewSet, PortfolioTemplateViewSet

router = DefaultRouter()
router.register(r"templates", PortfolioTemplateViewSet, basename="portfolio-template")
router.register(r"reports", GeneratedPortfolioViewSet, basename="portfolio-report")

urlpatterns = [
    path("", include(router.urls)),
]
