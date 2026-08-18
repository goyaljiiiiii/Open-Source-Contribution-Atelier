import pytest
from django.contrib.auth import get_user_model
from apps.accounts.serializers import EmailOrUsernameTokenObtainPairSerializer

User = get_user_model()


@pytest.mark.django_db
def test_token_obtain_serializer_remember_me():
    user = User.objects.create_user(username="remember_user", password="StrongPassword123!")
    serializer = EmailOrUsernameTokenObtainPairSerializer(
        data={"username": "remember_user", "password": "StrongPassword123!", "remember": True}
    )
    assert serializer.is_valid()
    result = serializer.validated_data
    assert result.get("remember") is True
    assert "access" in result
    assert "refresh" in result
