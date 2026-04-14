from rest_framework.generics import ListAPIView
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Badge, LessonProgress
from .serializers import BadgeSerializer, LessonProgressSerializer
from apps.content.models import Lesson

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
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

class CommunityStatsView(APIView):
    def get(self, request):
        from django.contrib.auth.models import User
        user_count = User.objects.count()
        completed_lessons = LessonProgress.objects.filter(completed=True).count()
        # Simulated/Aesthetic stats based on real data
        active_contributors = 100 + user_count
        merged_prs = 300 + completed_lessons
        
        return Response({
            "active_contributors": active_contributors,
            "merged_prs": merged_prs,
            "response_sla": "3.5h",
            "open_requests": 15
        })

