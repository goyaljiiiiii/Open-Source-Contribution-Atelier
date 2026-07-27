from django.urls import path

from .views import DXFrictionView, DXHistoryView, DXMetricsIngestView, DXOverviewView

urlpatterns = [
    path("overview/", DXOverviewView.as_view(), name="dx_overview"),
    path("history/", DXHistoryView.as_view(), name="dx_history"),
    path("friction/", DXFrictionView.as_view(), name="dx_friction"),
    path("metrics/", DXMetricsIngestView.as_view(), name="dx_metrics"),
]
