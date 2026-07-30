from django.urls import path

from .views import PerformanceDashboardView

urlpatterns = [
    path(
        "performance/", PerformanceDashboardView.as_view(), name="performance-dashboard"
    ),
]
