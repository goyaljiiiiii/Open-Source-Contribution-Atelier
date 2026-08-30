from django.db import models
from rest_framework import permissions, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.errors.models import ErrorEvent, ErrorGroup
from apps.errors.serializers import ErrorEventSerializer, ErrorGroupSerializer
from apps.errors.tasks import ingest_error_event_task


class ErrorIngestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Receives an error payload and immediately offloads it to a Celery task.
        """
        payload = request.data
        if not payload or "message" not in payload:
            return Response(
                {"error": "Missing message field in payload"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Offload to celery immediately for async high throughput
        ingest_error_event_task.delay(payload)

        return Response({"status": "queued"}, status=status.HTTP_202_ACCEPTED)


class ErrorGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for Error Monitoring Admin list view.
    Allows case-insensitive substring matching on exception_class.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ErrorGroupSerializer

    def get_queryset(self):
        qs = ErrorGroup.objects.all()

        exception_class = self.request.query_params.get("exception_class")
        if exception_class:
            qs = qs.filter(exception_class__icontains=exception_class)

        module_param = self.request.query_params.get("module")
        if module_param:
            qs = qs.filter(module__icontains=module_param)

        status_param = self.request.query_params.get("status")
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.lower())

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                models.Q(message__icontains=search)
                | models.Q(fingerprint__icontains=search)
                | models.Q(exception_class__icontains=search)
            )

        return qs


class ErrorEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing detailed Error Events.
    Allows case-insensitive substring matching on exception_class.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ErrorEventSerializer

    def get_queryset(self):
        qs = ErrorEvent.objects.all()

        exception_class = self.request.query_params.get("exception_class")
        if exception_class:
            qs = qs.filter(exception_class__icontains=exception_class)

        group_id = self.request.query_params.get("group")
        if group_id:
            qs = qs.filter(group_id=group_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                models.Q(raw_message__icontains=search)
                | models.Q(exception_class__icontains=search)
            )

        return qs
