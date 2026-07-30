from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import ExpertiseDomain, IssueRouting, MaintainerExpertise, RoutingMetric
from .serializers import (
    ExpertiseDomainSerializer,
    IssueRoutingSerializer,
    MaintainerExpertiseSerializer,
    RoutingMetricSerializer,
)


class ExpertiseDomainViewSet(viewsets.ModelViewSet):
    queryset = ExpertiseDomain.objects.all()
    serializer_class = ExpertiseDomainSerializer
    permission_classes = [IsAuthenticated]


class MaintainerExpertiseViewSet(viewsets.ModelViewSet):
    queryset = MaintainerExpertise.objects.all()
    serializer_class = MaintainerExpertiseSerializer
    permission_classes = [IsAuthenticated]


class IssueRoutingViewSet(viewsets.ModelViewSet):
    queryset = IssueRouting.objects.all()
    serializer_class = IssueRoutingSerializer
    permission_classes = [IsAuthenticated]


class RoutingMetricViewSet(viewsets.ModelViewSet):
    queryset = RoutingMetric.objects.all()
    serializer_class = RoutingMetricSerializer
    permission_classes = [IsAuthenticated]
