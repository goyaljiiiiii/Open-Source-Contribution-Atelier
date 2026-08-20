from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExpertiseDomainViewSet,
    IssueRoutingViewSet,
    MaintainerExpertiseViewSet,
    RoutingMetricViewSet,
)

router = DefaultRouter()
router.register(r"expertise-domain", ExpertiseDomainViewSet, basename="expertise-domain")
router.register(r"maintainer-expertise", MaintainerExpertiseViewSet, basename="maintainer-expertise")
router.register(r"issue-routing", IssueRoutingViewSet, basename="issue-routing")
router.register(r"routing-metric", RoutingMetricViewSet, basename="routing-metric")

urlpatterns = [
    path("", include(router.urls)),
]
