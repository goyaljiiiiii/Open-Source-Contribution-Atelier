import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from unittest.mock import patch, Mock


@pytest.mark.django_db
def test_signup_and_login_flow():
    client = APIClient()
    signup_response = client.post(
        "/api/auth/signup/",
        {"username": "mentor", "email": "mentor@example.com", "password": "strongpass123"},
        format="json",
    )
    assert signup_response.status_code == 201

    login_response = client.post(
        "/api/auth/login/",
        {"username": "mentor", "password": "strongpass123"},
        format="json",
    )
    assert login_response.status_code == 200
    assert "access" in login_response.data


@pytest.mark.django_db
def test_login_with_email_identifier():
    client = APIClient()
    User.objects.create_user(
        username="mentor_email_login",
        email="mentor-email@example.com",
        password="strongpass123",
    )

    login_response = client.post(
        "/api/auth/login/",
        {"username": "mentor-email@example.com", "password": "strongpass123"},
        format="json",
    )

    assert login_response.status_code == 200
    assert "access" in login_response.data


@pytest.mark.django_db
@patch("apps.accounts.views.http_requests.get")
def test_google_login_creates_user_and_returns_tokens(mock_get):
    client = APIClient()

    mock_resp = Mock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"email": "google-user@example.com"}
    mock_get.return_value = mock_resp

    response = client.post(
        "/api/auth/google/",
        {"access_token": "fake-token"},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert User.objects.filter(email="google-user@example.com").exists()


@pytest.mark.django_db
def test_sandbox_verifier_rejects_unsafe_command():
    user = User.objects.create_user(username="admin", password="strongpass123")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(
        "/api/sandbox/verify/",
        {"command": "rm -rf .", "expected_command": "git status"},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["accepted"] is False

