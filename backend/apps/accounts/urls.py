from django.urls import path
from .views import (
    SignupView, 
    VerifyEmailView, 
    LoginView, 
    RefreshView, 
    MeView, 
    GoogleLoginView, 
    UserListView
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    # Verification path added to handle the token sent via email
    path("verify/<str:token>/", VerifyEmailView.as_view(), name="verify-email"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("users/", UserListView.as_view(), name="user-list"),
]