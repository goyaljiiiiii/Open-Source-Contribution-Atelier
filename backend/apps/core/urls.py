from django.urls import path

from .views import DbPoolStatusView, I18nDetectView, PerformanceDashboardView

urlpatterns = [
    path(
        "performance/", PerformanceDashboardView.as_view(), name="performance-dashboard"
    ),
    path(
        "i18n/detect/", I18nDetectView.as_view(), name="i18n-detect"
    ),
    path("pool", DbPoolStatusView.as_view(), name="db-pool-status"),
    path("pool/", DbPoolStatusView.as_view(), name="db-pool-status-slash"),
]
