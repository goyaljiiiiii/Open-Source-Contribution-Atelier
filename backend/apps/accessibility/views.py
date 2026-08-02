from django.db.models import Count
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import A11yIssue


class A11yIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = A11yIssue
        fields = "__all__"


class A11yIssuePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class A11yIssueViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows accessibility issues to be viewed by admins.
    """

    queryset = A11yIssue.objects.all()
    serializer_class = A11yIssueSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = A11yIssuePagination

    @action(detail=False, methods=["get"])
    def summary(self, request):
        stats = A11yIssue.objects.values("severity", "status").annotate(
            count=Count("id")
        )

        return Response({"stats": list(stats)})
