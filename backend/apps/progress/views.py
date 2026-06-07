from .models import (
    Badge,
    HelpRequest,
    LessonProgress,
    ExerciseAttempt,
)
from rest_framework import permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.content.models import Lesson
from .models import Badge, HelpRequest, LessonProgress
from .serializers import BadgeSerializer, HelpRequestSerializer, LessonProgressSerializer


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
    
class UserAchievementsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        completed_lessons = LessonProgress.objects.filter(
            user=request.user,
            completed=True
        ).count()

        exercises_completed = ExerciseAttempt.objects.filter(
            user=request.user,
            is_correct=True
        ).count()

        help_requests = HelpRequest.objects.filter(
            user=request.user
        ).count()

        badges = []

        if completed_lessons >= 1:
            badges.append({
                "name": "First Contribution",
                "description": "Completed your first lesson"
            })

        if completed_lessons >= 5:
            badges.append({
                "name": "Consistent Learner",
                "description": "Completed 5 lessons"
            })

        if completed_lessons >= 10:
            badges.append({
                "name": "Knowledge Explorer",
                "description": "Completed 10 lessons"
            })

        if exercises_completed >= 5:
            badges.append({
                "name": "Challenge Solver",
                "description": "Solved 5 exercises"
            })

        if help_requests >= 3:
            badges.append({
                "name": "Community Helper",
                "description": "Created 3 help requests"
            })

        return Response({
            "earned_badges": badges
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
