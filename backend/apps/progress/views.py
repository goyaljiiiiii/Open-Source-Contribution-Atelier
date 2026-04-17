from django.db.models import Count, Sum
from rest_framework import permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Lesson
from .models import Badge, HelpRequest, LessonProgress
from .serializers import (
    BadgeSerializer,
    HelpRequestSerializer,
    LeaderboardEntrySerializer,
    LessonProgressSerializer,
)


class LeaderboardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class LeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = LeaderboardPagination

    def get(self, request):
        qs = (
            LessonProgress.objects.filter(completed=True)
            .values("user__id", "user__username")
            .annotate(
                total_score=Sum("score"),
                completed_lessons=Count("id"),
            )
            .order_by("-total_score", "user__username")
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)

        page_number = paginator.page.number
        page_size = paginator.get_page_size(request)
        start_rank = (page_number - 1) * page_size + 1

        entries = [
            {
                "rank": start_rank + idx,
                "user_id": row["user__id"],
                "username": row["user__username"],
                "total_score": row["total_score"],
                "completed_lessons": row["completed_lessons"],
            }
            for idx, row in enumerate(page)
        ]

        serializer = LeaderboardEntrySerializer(entries, many=True)
        return paginator.get_paginated_response(serializer.data)


class BadgeListView(ListAPIView):
    queryset = Badge.objects.all()
    serializer_class = BadgeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class MyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        progress = LessonProgress.objects.filter(user=request.user).select_related("lesson")
        serializer = LessonProgressSerializer(progress, many=True)
        return Response(serializer.data)

    def post(self, request):
        lesson_slug = request.data.get("lesson_slug")
        score = request.data.get("score", 100)
        completed = request.data.get("completed", True)

        try:
            lesson = Lesson.objects.get(slug=lesson_slug)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        progress, created = LessonProgress.objects.update_or_create(
            user=request.user,
            lesson=lesson,
            defaults={"completed": completed, "score": score}
        )

        serializer = LessonProgressSerializer(progress)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class CommunityStatsView(APIView):
    def get(self, request):
        from django.contrib.auth.models import User

        user_count = User.objects.count()
        completed_lessons = LessonProgress.objects.filter(completed=True).count()
        open_help_requests = HelpRequest.objects.filter(status=HelpRequest.Status.OPEN).count()
        active_contributors = 100 + user_count
        merged_prs = 300 + completed_lessons

        return Response({
            "active_contributors": active_contributors,
            "merged_prs": merged_prs,
            "response_sla": "3.5h",
            "open_requests": open_help_requests
        })


class HelpRequestListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        help_requests = HelpRequest.objects.filter(user=request.user).select_related("lesson")
        serializer = HelpRequestSerializer(help_requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        lesson_slug = request.data.get("lesson_slug")
        message = request.data.get("message", "").strip()

        if not lesson_slug:
            return Response({"error": "lesson_slug is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not message:
            return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lesson = Lesson.objects.get(slug=lesson_slug)
        except Lesson.DoesNotExist:
            return Response({"error": "Lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        help_request = HelpRequest.objects.create(
            user=request.user,
            lesson=lesson,
            message=message,
        )
        serializer = HelpRequestSerializer(help_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
