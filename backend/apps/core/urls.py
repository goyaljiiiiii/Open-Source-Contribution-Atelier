from django.urls import path

from .views import I18nDetectView, PerformanceDashboardView

urlpatterns = [
    path(
        "performance/", PerformanceDashboardView.as_view(), name="performance-dashboard"
    ),
    path(
        "i18n/detect/", I18nDetectView.as_view(), name="i18n-detect"
    ),
]
