from django.contrib.auth.models import User
from rest_framework import generics, filters, permissions, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
import requests as http_requests

from .serializers import SignupSerializer, UserListSerializer


class SignupView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    def get(self, request):
        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "is_staff": request.user.is_staff,
            }
        )


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("access_token")
        if not token:
            return Response({"detail": "No access token provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_info_resp = http_requests.get(
                f"https://www.googleapis.com/oauth2/v1/userinfo?access_token={token}"
            )

            if not user_info_resp.ok:
                return Response({"detail": "Failed to verify Google Token"}, status=status.HTTP_400_BAD_REQUEST)

            idinfo = user_info_resp.json()
            email = idinfo.get("email")
            if not email:
                return Response({"detail": "Google account has no email"}, status=status.HTTP_400_BAD_REQUEST)

            username = email.split("@")[0]
            user, created = User.objects.get_or_create(email=email, defaults={"username": username})

            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": {
                        "username": user.username,
                        "email": user.email,
                        "is_staff": user.is_staff,
                    },
                }
            )

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by("id")
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserListSerializer

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username"]
    ordering_fields = ["id", "username"]