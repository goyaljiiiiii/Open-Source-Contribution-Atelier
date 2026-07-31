from django.urls import path

from .views import DbPoolStatusView, PerformanceDashboardView

urlpatterns = [
    path(
        "performance/", PerformanceDashboardView.as_view(), name="performance-dashboard"
    ),
    path("pool", DbPoolStatusView.as_view(), name="db-pool-status"),
    path("pool/", DbPoolStatusView.as_view(), name="db-pool-status-slash"),
]
