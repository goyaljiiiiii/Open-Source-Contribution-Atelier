from django.urls import path

from apps.audit.views import AuditEventDetailView, AuditEventListView

urlpatterns = [
    path("", AuditEventListView.as_view(), name="audit-event-list"),
    path("<int:pk>/", AuditEventDetailView.as_view(), name="audit-event-detail"),
]
