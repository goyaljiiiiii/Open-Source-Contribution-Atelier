from rest_framework import viewsets, views, response
from django.db.models import Q

from .models import Lesson
from .serializers import LessonSerializer
from apps.challenges.models import Challenge
from apps.challenges.serializers import ChallengeSerializer

class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Lesson.objects.prefetch_related("exercises").all()
    serializer_class = LessonSerializer

class SearchView(views.APIView):
    def get(self, request):
        query = request.GET.get("q", "")
        if not query:
            return response.Response({"lessons": [], "challenges": []})
        
        lessons = Lesson.objects.filter(Q(title__icontains=query) | Q(summary__icontains=query))
        challenges = Challenge.objects.filter(Q(title__icontains=query) | Q(summary__icontains=query))
        
        return response.Response({
            "lessons": LessonSerializer(lessons, many=True).data,
            "challenges": ChallengeSerializer(challenges, many=True).data
        })

