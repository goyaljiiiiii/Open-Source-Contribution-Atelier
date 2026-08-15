from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AutoFixPRViewSet,
    ProjectDependencyViewSet,
    VulnerabilityItemViewSet,
    VulnerabilityReportViewSet,
    VulnerabilitySummaryView,
    VulnerabilitySuppressionViewSet,
)

router = DefaultRouter()
router.register(
    r"vulnerability-reports",
    VulnerabilityReportViewSet,
    basename="vulnerability-report",
)
router.register(
    r"vulnerabilities", VulnerabilityItemViewSet, basename="vulnerability-item"
)
router.register(
    r"suppressions",
    VulnerabilitySuppressionViewSet,
    basename="vulnerability-suppression",
)
router.register(r"autofix-prs", AutoFixPRViewSet, basename="autofix-pr")
router.register(
    r"project-dependencies", ProjectDependencyViewSet, basename="project-dependency"
)

urlpatterns = [
    path("summary/", VulnerabilitySummaryView.as_view(), name="vulnerability-summary"),
    path("", include(router.urls)),
]
