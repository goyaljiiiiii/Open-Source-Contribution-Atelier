from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model() # Get your CustomUser model dynamically

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "is_staff")

class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow login with either username or email."""

    def validate(self, attrs):
        username_key = self.username_field
        identifier = attrs.get(username_key, "")

        if isinstance(identifier, str) and "@" in identifier:
            # Look up via email
            user = User.objects.filter(email__iexact=identifier.strip()).first()
            if user:
                attrs = {**attrs, username_key: user.username}

        return super().validate(attrs)