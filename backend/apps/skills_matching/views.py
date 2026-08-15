from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import (
    ContributorProfile,
    IssueSkillTag,
    NewcomerFriendlinessScore,
    Recommendation,
    SkillGapAnalysis,
    SkillTag,
)
from .serializers import (
    ContributorProfileSerializer,
    IssueSkillTagSerializer,
    NewcomerFriendlinessScoreSerializer,
    RecommendationSerializer,
    SkillGapAnalysisSerializer,
    SkillTagSerializer,
)


class ContributorProfileViewSet(viewsets.ModelViewSet):
    queryset = ContributorProfile.objects.all()
    serializer_class = ContributorProfileSerializer
    permission_classes = [IsAuthenticated]


class SkillTagViewSet(viewsets.ModelViewSet):
    queryset = SkillTag.objects.all()
    serializer_class = SkillTagSerializer
    permission_classes = [IsAuthenticated]


class IssueSkillTagViewSet(viewsets.ModelViewSet):
    queryset = IssueSkillTag.objects.all()
    serializer_class = IssueSkillTagSerializer
    permission_classes = [IsAuthenticated]


class NewcomerFriendlinessScoreViewSet(viewsets.ModelViewSet):
    queryset = NewcomerFriendlinessScore.objects.all()
    serializer_class = NewcomerFriendlinessScoreSerializer
    permission_classes = [IsAuthenticated]


class RecommendationViewSet(viewsets.ModelViewSet):
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer
    permission_classes = [IsAuthenticated]


class SkillGapAnalysisViewSet(viewsets.ModelViewSet):
    queryset = SkillGapAnalysis.objects.all()
    serializer_class = SkillGapAnalysisSerializer
    permission_classes = [IsAuthenticated]
