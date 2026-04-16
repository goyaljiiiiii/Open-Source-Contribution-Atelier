from .views import SandboxExecutionView
from rest_framework.routers import DefaultRouter

from .views import ChallengeViewSet


router = DefaultRouter()
router.register("", ChallengeViewSet, basename="challenge")

urlpatterns = router.urls
urlpatterns += [path('sandbox/execute/', SandboxExecutionView.as_view(), name='sandbox-execute')]
