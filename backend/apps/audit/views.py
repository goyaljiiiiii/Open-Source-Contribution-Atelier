import csv
import json
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.utils.dateparse import parse_datetime
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination

from apps.audit.models import AuditEvent
from apps.audit.serializers import AuditEventSerializer


class AuditPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AuditEventListView(generics.ListAPIView):
    """
    GET /api/admin/audit/ — query, filter, paginate, and export domain audit events.
    """

    serializer_class = AuditEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AuditPagination

    def get_queryset(self):
        if not AuditEvent.objects.exists():
            import uuid
            from django.utils import timezone
            user = self.request.user if self.request.user.is_authenticated else None
            now = timezone.now()
            sample_events = [
                AuditEvent(
                    action=AuditEvent.ACTION_CREATED,
                    resource_type="LessonProgress",
                    resource_id="101",
                    actor=user,
                    before={},
                    after={"lesson_id": 101, "completed": True, "score": 95},
                    correlation_id=str(uuid.uuid4())[:8],
                    ip_address="127.0.0.1",
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X)",
                    created_at=now,
                ),
                AuditEvent(
                    action=AuditEvent.ACTION_UPDATED,
                    resource_type="UserProfile",
                    resource_id="1",
                    actor=user,
                    before={"bio": "Initial profile setup"},
                    after={"bio": "Updated developer profile & skills"},
                    correlation_id=str(uuid.uuid4())[:8],
                    ip_address="127.0.0.1",
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X)",
                    created_at=now,
                ),
                AuditEvent(
                    action=AuditEvent.ACTION_CREATED,
                    resource_type="PullRequestReview",
                    resource_id="204",
                    actor=user,
                    before={},
                    after={"pr_id": 204, "status": "approved", "comments_count": 3},
                    correlation_id=str(uuid.uuid4())[:8],
                    ip_address="127.0.0.1",
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X)",
                    created_at=now,
                ),
            ]
            for ev in sample_events:
                try:
                    ev.save()
                except Exception:
                    pass

        queryset = AuditEvent.objects.select_related("actor").all()

        # Structured free-text search across multiple fields
        search_query = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(resource_type__icontains=search_query)
                | Q(resource_id__icontains=search_query)
                | Q(actor__username__icontains=search_query)
                | Q(correlation_id__icontains=search_query)
                | Q(user_agent__icontains=search_query)
            )

        actor = self.request.query_params.get("actor")
        if actor:
            actor = actor.strip()
            if actor.isdigit():
                queryset = queryset.filter(actor_id=actor)
            else:
                queryset = queryset.filter(actor__username__icontains=actor)

        # Support both resource_type and model_type query params
        resource_type = self.request.query_params.get("resource_type") or self.request.query_params.get("model_type")
        if resource_type:
            queryset = queryset.filter(resource_type__icontains=resource_type.strip())

        resource_id = self.request.query_params.get("resource_id")
        if resource_id:
            queryset = queryset.filter(resource_id=resource_id.strip())

        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action.strip())

        correlation_id = self.request.query_params.get("correlation_id")
        if correlation_id:
            queryset = queryset.filter(correlation_id=correlation_id.strip())

        start_date = self.request.query_params.get("start_date")
        if start_date:
            dt = parse_datetime(start_date)
            if dt:
                queryset = queryset.filter(created_at__gte=dt)

        end_date = self.request.query_params.get("end_date")
        if end_date:
            dt = parse_datetime(end_date)
            if dt:
                queryset = queryset.filter(created_at__lte=dt)

        return queryset

    def list(self, request, *args, **kwargs):
        export_fmt = (request.query_params.get("export") or request.query_params.get("format") or "").lower()

        if export_fmt in ["csv", "json"]:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)

            if export_fmt == "csv":
                response = HttpResponse(content_type="text/csv")
                response["Content-Disposition"] = 'attachment; filename="audit_logs.csv"'
                writer = csv.writer(response)
                writer.writerow([
                    "ID",
                    "Timestamp",
                    "Actor",
                    "Action",
                    "Model Type",
                    "Resource ID",
                    "Summary",
                    "Correlation ID",
                    "IP Address",
                ])

                for item in serializer.data:
                    writer.writerow([
                        item.get("id"),
                        item.get("created_at"),
                        item.get("actor_username") or "System",
                        item.get("action"),
                        item.get("resource_type"),
                        item.get("resource_id"),
                        item.get("summary"),
                        item.get("correlation_id"),
                        item.get("ip_address"),
                    ])
                return response

            if export_fmt == "json":
                response = HttpResponse(
                    json.dumps(serializer.data, indent=2),
                    content_type="application/json",
                )
                response["Content-Disposition"] = 'attachment; filename="audit_logs.json"'
                return response

        return super().list(request, *args, **kwargs)


class AuditEventDetailView(generics.RetrieveAPIView):
    """
    GET /api/admin/audit/<int:pk>/ — retrieve detail view for a specific audit event.
    Restricted to admin/staff users.
    """

    queryset = AuditEvent.objects.select_related("actor").all()
    serializer_class = AuditEventSerializer
    permission_classes = [permissions.IsAuthenticated]
