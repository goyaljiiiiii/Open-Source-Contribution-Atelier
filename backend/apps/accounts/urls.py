from django.urls import path

from .views import (
    GitHubOAuthCallbackView,
    GitHubOAuthStartView,
    GoogleLoginView,
    LoginView,
    MeView,
    RefreshView,
    SignupView,
    UserListView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    OtpRequestView,
    OtpVerifyView,
    LogoutView,
)


urlpatterns = [
    # ── Core Auth ──────────────────────────────────────────────────────────────
    path("signup/",           SignupView.as_view(),             name="signup"),
    path("login/",            LoginView.as_view(),              name="login"),
    path("refresh/",          RefreshView.as_view(),            name="refresh"),
    path("me/",               MeView.as_view(),                 name="me"),
    path("users/",            UserListView.as_view(),           name="user-list"),
    path("logout/",           LogoutView.as_view(),             name="logout"),

    # ── OAuth ──────────────────────────────────────────────────────────────────
    path("google/",           GoogleLoginView.as_view(),        name="google-login"),
    path("github/",           GitHubOAuthStartView.as_view(),   name="github-login"),
    path("github/callback/",  GitHubOAuthCallbackView.as_view(),name="github-callback"),

    # ── Password Reset ─────────────────────────────────────────────────────────
    path("password-reset/",          PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/",  PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # ── OTP / Email Verification ───────────────────────────────────────────────
    path("otp/request/",  OtpRequestView.as_view(), name="otp-request"),
    path("otp/verify/",   OtpVerifyView.as_view(),  name="otp-verify"),
]
