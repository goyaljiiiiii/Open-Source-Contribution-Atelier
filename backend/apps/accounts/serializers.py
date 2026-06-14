from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

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
    # These fields must be defined at the class level
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False)

    # 1. Keep your class Meta here
    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    # 2. REPLACE your old validate function with this one
    def validate(self, attrs):
        email = attrs.get("email")
        username = attrs.get("username")

        # Logic to map email to username if email is provided
        if email and not username:
            user = User.objects.filter(email__iexact=email.strip()).first()
            if user:
                attrs['username'] = user.username
        
        # Now call the parent class's validate method
        return super().validate(attrs)