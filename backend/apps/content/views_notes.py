from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from apps.progress.models import UserNote
from apps.content.models import Lesson

class LessonNoteAPIView(APIView):
    """
    API view for managing personal lesson notes for the authenticated user.
    GET /api/lessons/:id/notes - Retrieves user note for lesson ID or slug
    POST /api/lessons/:id/notes - Saves/updates user note for lesson ID or slug
    """
    permission_classes = [IsAuthenticated]

    def _get_or_create_lesson(self, lesson_id):
        if lesson_id.isdigit():
            lesson = Lesson.objects.filter(id=int(lesson_id)).first()
            if lesson:
                return lesson
        
        lesson = Lesson.objects.filter(slug=lesson_id).first()
        if not lesson:
            # Auto-create lesson stub by slug so notes work for all curriculum lessons
            title = lesson_id.replace("-", " ").title()
            lesson = Lesson.objects.create(slug=lesson_id, title=title, content="Lesson Content")
        return lesson

    def get(self, request, lesson_id):
        lesson = Lesson.objects.filter(slug=lesson_id).first() or (
            Lesson.objects.filter(id=int(lesson_id)).first() if lesson_id.isdigit() else None
        )
        if lesson:
            note = UserNote.objects.filter(user=request.user, lesson=lesson).first()
        else:
            note = None

        return Response({
            "lesson_id": lesson_id,
            "content": note.content if note else "",
            "updated_at": note.updated_at.isoformat() if note and note.updated_at else None,
        })

    def post(self, request, lesson_id):
        content = request.data.get("content", request.data.get("note", ""))
        lesson = self._get_or_create_lesson(lesson_id)

        note, _ = UserNote.objects.get_or_create(user=request.user, lesson=lesson)
        note.content = content
        note.save()

        return Response({
            "lesson_id": lesson_id,
            "content": note.content,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        }, status=status.HTTP_200_OK)
