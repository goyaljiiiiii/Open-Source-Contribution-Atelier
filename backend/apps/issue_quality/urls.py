from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IssueQualityViewSet
from .views.scan_report_view import ScanReportView

router = DefaultRouter()
router.register(r"issue-quality", IssueQualityViewSet, basename="issue-quality")

urlpatterns = [
    path("", include(router.urls)),
    path("scan/", ScanReportView.as_view(), name="scan-create"),
    path("scan/<int:pk>/", ScanReportView.as_view(), name="scan-detail"),
]
