from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import BurnoutMetric, BurnoutSignal, ContributorActivity, Intervention
from .serializers import (
    BurnoutMetricSerializer,
    BurnoutSignalSerializer,
    ContributorActivitySerializer,
    InterventionSerializer,
)


class ContributorActivityViewSet(viewsets.ModelViewSet):
    queryset = ContributorActivity.objects.all()
    serializer_class = ContributorActivitySerializer
    permission_classes = [IsAuthenticated]


class BurnoutSignalViewSet(viewsets.ModelViewSet):
    queryset = BurnoutSignal.objects.all()
    serializer_class = BurnoutSignalSerializer
    permission_classes = [IsAuthenticated]


class InterventionViewSet(viewsets.ModelViewSet):
    queryset = Intervention.objects.all()
    serializer_class = InterventionSerializer
    permission_classes = [IsAuthenticated]


class BurnoutMetricViewSet(viewsets.ModelViewSet):
    queryset = BurnoutMetric.objects.all()
    serializer_class = BurnoutMetricSerializer
    permission_classes = [IsAuthenticated]
