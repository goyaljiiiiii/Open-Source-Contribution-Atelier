from django.urls import path
from .views import SignupView, LoginView, RefreshView, MeView, GoogleLoginView, UserListView

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("users/", UserListView.as_view(), name="user-list"),
]