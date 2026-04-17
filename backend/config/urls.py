from django.contrib import admin
from django.urls import include, path

from apps.progress.views import LeaderboardView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/progress/", include("apps.progress.urls")),
    path("api/challenges/", include("apps.challenges.urls")),
    path("api/sandbox/", include("apps.sandbox.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]

