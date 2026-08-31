import logging

from django.http import StreamingHttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import AiTutorService
from .throttles import AiTutorRateThrottle

logger = logging.getLogger(__name__)


class TutorAskView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AiTutorRateThrottle]

    def post(self, request):
        question = request.data.get("question", "").strip()
        lesson_slug = request.data.get("lesson_slug", "")
        history = request.data.get("history", [])

        if not question:
            return Response(
                {"error": "Question is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lesson_context = ""
        if lesson_slug:
            try:
                from apps.content.models import Lesson

                lesson = Lesson.objects.filter(slug=lesson_slug).first()
                if lesson:
                    summary_text = getattr(lesson, "summary", "") or getattr(
                        lesson, "description", ""
                    )
                    lesson_context = (
                        f"Lesson title: {lesson.title}\nSummary: {summary_text[:500]}"
                    )
            except Exception as e:
                logger.warning("Caught exception: %s", e)

        stream_generator = AiTutorService.get_streaming_response(
            question=question,
            lesson_context=lesson_context,
            history=history,
        )

        return StreamingHttpResponse(
            stream_generator,
            content_type="text/event-stream",
        )

