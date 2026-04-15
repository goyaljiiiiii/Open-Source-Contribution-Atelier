from django.urls import path

from .views import LoginView, MeView, RefreshView, SignupView, GoogleLoginView, UserListView


urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
]

