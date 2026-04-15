from django.urls import path

from .views import BadgeListView, MyProgressView, CommunityStatsView


urlpatterns = [
    path("badges/", BadgeListView.as_view(), name="badges"),
    path("me/", MyProgressView.as_view(), name="my-progress"),
    path("community-stats/", CommunityStatsView.as_view(), name="community-stats"),
]

