from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.pr_review_bot.models import CodeIssue, PRReview, PRReviewComment, ReviewConfig
from apps.pr_review_bot.serializers import (
    CodeIssueSerializer,
    PRReviewCommentSerializer,
    PRReviewSerializer,
    ReviewConfigSerializer,
)
from apps.pr_review_bot.views.impact_views import PRImpactAnalysisViewSet


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


class PRImpactAnalysisViewSet(viewsets.ViewSet):
    """
    API ViewSet for Automated PR Code Impact & Flaky Test Risk Prediction Engine (#2321).
    """

    permission_classes = [AllowAny]

    def create(self, request):
        """
        Analyze a PR diff, predict flaky test risks, and generate impact reports.
        """
        from apps.pr_review_bot.services.impact_analyzer import PRImpactAnalyzer
        from apps.pr_review_bot.tasks import analyze_pr_impact_task

        pr_number = request.data.get("pr_number")
        repository = request.data.get("repository", "Open-Source-Contribution-Atelier")
        changed_files = request.data.get("changed_files", [])
        added_lines = request.data.get("added_lines", 0)
        deleted_lines = request.data.get("deleted_lines", 0)
        raw_diff = request.data.get("raw_diff", "")
        async_run = request.data.get("async", False)

        if not pr_number:
            return Response(
                {"error": "Field 'pr_number' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if async_run:
            analyze_pr_impact_task.delay(
                pr_number=int(pr_number),
                repository=repository,
                changed_files=changed_files,
                added_lines=added_lines,
                deleted_lines=deleted_lines,
                raw_diff=raw_diff,
            )
            return Response(
                {
                    "message": f"Impact analysis task queued for PR #{pr_number}.",
                    "pr_number": pr_number,
                    "status": "processing",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        analyzer = PRImpactAnalyzer()
        result = analyzer.analyze_pr_impact(
            pr_number=int(pr_number),
            repository=repository,
            changed_files=changed_files,
            added_lines=added_lines,
            deleted_lines=deleted_lines,
            raw_diff=raw_diff,
        )

        return Response(result, status=status.HTTP_200_OK)

    def list(self, request):
        """
        List or query historical PR impact health metrics.
        """
        pr_number = request.query_params.get("pr_number")
        repository = request.query_params.get(
            "repository", "Open-Source-Contribution-Atelier"
        )

        if pr_number:
            review = PRReview.objects.filter(
                pr_number=pr_number, repository=repository
            ).first()
            if not review:
                return Response(
                    {"error": f"No impact record found for PR #{pr_number}."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            return Response(
                {
                    "pr_number": review.pr_number,
                    "repository": review.repository,
                    "title": review.pr_title,
                    "author": review.pr_author,
                    "risk_score": round(100.0 - review.test_coverage_score, 1),
                    "summary": review.summary,
                    "processed_at": review.processed_at,
                }
            )

        reviews = PRReview.objects.all()[:20]
        data = [
            {
                "pr_number": r.pr_number,
                "repository": r.repository,
                "title": r.pr_title,
                "author": r.pr_author,
                "risk_score": round(100.0 - r.test_coverage_score, 1),
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in reviews
        ]
        return Response(data, status=status.HTTP_200_OK)


__all__ = [
    "PRReviewViewSet",
    "CodeIssueViewSet",
    "PRReviewCommentViewSet",
    "ReviewConfigViewSet",
    "PRImpactAnalysisViewSet",
]
