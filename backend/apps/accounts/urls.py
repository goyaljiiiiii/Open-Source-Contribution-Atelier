from django.urls import path

from .views import (
    LoginView,
    MeView,
    RefreshView,
    SignupView,
    GoogleLoginView,
    UserListView,
    RepositoryRecommendationView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("recommendations/", RepositoryRecommendationView.as_view(), name="repository-recommendations"),
]