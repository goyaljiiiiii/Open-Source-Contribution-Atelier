from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.monitoring.exporters.prometheus_exporter import metrics_view
from apps.monitoring.views import (
    BackupVerificationViewSet,
    CeleryStatsView,
    TaskRunViewSet,
    TaskTypeStatsView,
)

router = DefaultRouter()
router.register(r"backups", BackupVerificationViewSet, basename="backup-verification")
router.register(r"celery-task-runs", TaskRunViewSet, basename="celery-task-runs")

urlpatterns = [
    path("metrics/", metrics_view, name="prometheus-metrics"),
    path("celery-stats/", CeleryStatsView.as_view(), name="celery-stats"),
    path("celery-task-stats/", TaskTypeStatsView.as_view(), name="celery-task-stats"),
    path("", include(router.urls)),
]
