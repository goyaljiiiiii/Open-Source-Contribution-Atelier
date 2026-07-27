from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import CodeIssue, PRReview, PRReviewComment, ReviewConfig
from .serializers import (
    CodeIssueSerializer,
    PRReviewCommentSerializer,
    PRReviewSerializer,
    ReviewConfigSerializer,
)


class PRReviewViewSet(viewsets.ModelViewSet):
    queryset = PRReview.objects.all()
    serializer_class = PRReviewSerializer
    permission_classes = [IsAuthenticated]


class CodeIssueViewSet(viewsets.ModelViewSet):
    queryset = CodeIssue.objects.all()
    serializer_class = CodeIssueSerializer
    permission_classes = [IsAuthenticated]


class PRReviewCommentViewSet(viewsets.ModelViewSet):
    queryset = PRReviewComment.objects.all()
    serializer_class = PRReviewCommentSerializer
    permission_classes = [IsAuthenticated]


class ReviewConfigViewSet(viewsets.ModelViewSet):
    queryset = ReviewConfig.objects.all()
    serializer_class = ReviewConfigSerializer
    permission_classes = [IsAuthenticated]
