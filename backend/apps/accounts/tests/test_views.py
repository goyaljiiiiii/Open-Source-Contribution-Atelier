from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()

MAX_PASSWORD_LENGTH = 128
OVERSIZED_PASSWORD = "A1!" + ("a" * 200)  # well over 128 characters


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def existing_user(db):
    return User.objects.create_user(
        username="pw_length_user",
        email="pw_length_user@example.com",
        password="ValidPassw0rd!",
    )


@pytest.mark.django_db
class TestPasswordMaxLengthValidation:
    @pytest.fixture(autouse=True)
    def _clear_cache(self):
        from django.core.cache import cache

        cache.clear()

    def test_signup_rejects_oversized_password_with_400(self, api_client):
        with patch("django.contrib.auth.hashers.make_password") as hash_spy:
            response = api_client.post(
                reverse("signup"),
                {
                    "username": "new_user",
                    "email": "new_user@example.com",
                    "password": OVERSIZED_PASSWORD,
                },
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.data or "password" in response.data.get("errors", {})
        hash_spy.assert_not_called()

    def test_login_rejects_oversized_password_with_400(self, api_client, existing_user):
        with patch(
            "django.contrib.auth.base_user.AbstractBaseUser.check_password"
        ) as check_password_spy:
            response = api_client.post(
                reverse("login"),
                {"username": existing_user.username, "password": OVERSIZED_PASSWORD},
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        check_password_spy.assert_not_called()

    def test_login_accepts_password_within_limit(self, api_client, existing_user):
        response = api_client.post(
            reverse("login"),
            {"username": existing_user.username, "password": "ValidPassw0rd!"},
        )

        assert response.status_code == status.HTTP_200_OK