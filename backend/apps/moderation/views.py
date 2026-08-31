from django.db import IntegrityError
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsModeratorOrAdmin
from apps.moderation.audit_utils import log_moderation_action
from apps.moderation.models import ContentReport, ModerationAuditEvent
from apps.moderation.serializers import (
    ContentReportSerializer,
    ModerationActionSerializer,
)


class ContentReportListCreateView(generics.ListCreateAPIView):
    serializer_class = ContentReportSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [IsModeratorOrAdmin()]

    def get_queryset(self):
        # Admins see all pending reports by default
        qs = ContentReport.objects.all()
        status_param = self.request.query_params.get("status", "PENDING")
        if status_param and status_param != "ALL":
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        try:
            serializer.save(reporter=self.request.user)
        except IntegrityError:
            # Handle unique constraint violation
            raise serializers.ValidationError(
                {"error": "You have already reported this content."}
            )


class ContentReportActionView(APIView):
    permission_classes = [IsModeratorOrAdmin]

    def post(self, request, pk):

        report = generics.get_object_or_404(ContentReport, pk=pk)
        serializer = ModerationActionSerializer(data=request.data)

        if serializer.is_valid():
            old_status = report.status
            new_status = serializer.validated_data["status"]
            report.status = new_status
            report.moderator = request.user

            if new_status == ContentReport.Status.APPROVED:
                # Need to hide the actual content
                content_obj = report.content_object
                if content_obj and hasattr(content_obj, "is_hidden"):
                    content_obj.is_hidden = True
                    content_obj.save(update_fields=["is_hidden"])
                report.action_taken = ContentReport.ActionTaken.HIDDEN
            elif new_status == ContentReport.Status.DISMISSED:
                report.action_taken = ContentReport.ActionTaken.NONE

            report.save()

            # Determine target user (author/owner of the reported content, or reporter fallback)
            content_obj = report.content_object
            target_user = None
            if content_obj:
                target_user = (
                    getattr(content_obj, "user", None)
                    or getattr(content_obj, "reviewer", None)
                    or getattr(content_obj, "author", None)
                )
            if not target_user:
                target_user = report.reporter

            log_moderation_action(
                content_report=report,
                moderator=request.user,
                target_user=target_user,
                status_before=old_status,
                status_after=new_status,
                action_taken=report.action_taken,
                reason=serializer.validated_data.get("reason", ""),
            )

            return Response(ContentReportSerializer(report).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

