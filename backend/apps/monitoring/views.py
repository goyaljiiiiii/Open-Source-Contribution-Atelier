import threading
from datetime import timedelta

from django.core.management import call_command
from django.db import models
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.monitoring.celery_monitor import get_celery_stats, get_task_type_stats
from apps.monitoring.models import BackupVerification, TaskRun
from apps.monitoring.serializers import BackupVerificationSerializer, TaskRunSerializer


class BackupVerificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows admins to view backup verification history and trigger a manual restore verification.
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = BackupVerificationSerializer

    def get_queryset(self):
        # Default to last 30 days
        thirty_days_ago = timezone.now() - timedelta(days=30)
        return BackupVerification.objects.filter(
            verification_timestamp__gte=thirty_days_ago
        )

    @action(detail=False, methods=["post"])
    def verify_now(self, request):
        """
        Triggers a manual backup verification in the background.
        """

        def run_verify():
            call_command("verify_backup")

        thread = threading.Thread(target=run_verify)
        thread.start()

        return Response(
            {"detail": "Backup verification started in background."},
            status=status.HTTP_202_ACCEPTED,
        )


class CeleryStatsView(APIView):
    """
    API endpoint that exposes Celery metrics: queue depth, worker count, active & reserved tasks.
    Protected behind staff/admin permission check.
    """

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        data = get_celery_stats()
        return Response(data, status=status.HTTP_200_OK)


class TaskTypeStatsView(APIView):
    """
    API endpoint that exposes per-task-type statistics, top 5 failing tasks, and 24h sparkline data.
    Protected behind staff/admin permission check.
    """

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        data = get_task_type_stats()
        return Response(data, status=status.HTTP_200_OK)


class TaskRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint to list and search recent Celery TaskRuns.
    Protected behind staff/admin permission check.
    """

    permission_classes = [permissions.IsAdminUser]
    serializer_class = TaskRunSerializer

    def get_queryset(self):
        qs = TaskRun.objects.all()
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                models.Q(task_name__icontains=search)
                | models.Q(task_id__icontains=search)
                | models.Q(error_message__icontains=search)
            )
        status_param = self.request.query_params.get("status")
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())
        return qs

