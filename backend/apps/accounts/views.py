from django.contrib.auth.models import User
from rest_framework import generics, filters, permissions, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
import requests as http_requests
from django.utils.text import slugify
import secrets

from .serializers import SignupSerializer, UserListSerializer, EmailOrUsernameTokenObtainPairSerializer


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
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @staticmethod
    def _unique_username_from_email(email: str) -> str:
        base = slugify(email.split("@")[0]) or "user"
        candidate = base
        suffix = 1

        while User.objects.filter(username=candidate).exists():
            candidate = f"{base}{suffix}"
            suffix += 1

        return candidate

    def post(self, request):
        token = request.data.get("access_token")
        if not token:
            return Response({"detail": "No access token provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Use OAuth2 userinfo endpoint with Bearer auth for better compatibility.
            user_info_resp = http_requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )

            if not user_info_resp.ok:
                return Response({"detail": "Failed to verify Google token"}, status=status.HTTP_401_UNAUTHORIZED)

            idinfo = user_info_resp.json()
            email = idinfo.get("email")
            if not email:
                return Response({"detail": "Google account has no email"}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                username = self._unique_username_from_email(email)
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=secrets.token_urlsafe(24),
                )

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

class RepositoryRecommendationView(APIView):
      # permission_classes = [IsAuthenticated]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        skill = request.GET.get("skill", "").lower()

        repositories = {
            "python": [
                {
                    "name": "awesome-python",
                    "language": "Python",
                    "difficulty": "Intermediate",
                    "url": "https://github.com/vinta/awesome-python",
                }
            ],
            "javascript": [
                {
                    "name": "freeCodeCamp",
                    "language": "JavaScript",
                    "difficulty": "Beginner",
                    "url": "https://github.com/freeCodeCamp/freeCodeCamp",
                }
            ],
            "react": [
                {
                    "name": "first-contributions",
                    "language": "JavaScript",
                    "difficulty": "Beginner",
                    "url": "https://github.com/firstcontributions/first-contributions",
                }
            ],
        }

        recommendations = repositories.get(skill, [])

        return Response(recommendations)