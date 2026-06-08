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
from .models import Badge, HelpRequest, LessonProgress, ExerciseAttempt, QuizAttempt

from apps.content.models import Lesson
from .models import Badge, HelpRequest, LessonProgress, ExerciseAttempt
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
            lesson = Lesson.objects.create(
                slug=lesson_slug,
                title=lesson_slug.replace("-", " ").title(),
                summary="Dynamic learning module",
                content="Dynamic content loaded from local file storage.",
                difficulty="beginner"
            )

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
    
class ContributorTimelineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        completed_lessons = LessonProgress.objects.filter(
            user=request.user,
            completed=True
        ).count()

        exercise_attempts = ExerciseAttempt.objects.filter(
            user=request.user
        ).count()

        help_requests = HelpRequest.objects.filter(
            user=request.user
        ).count()

        return Response({
            "first_contribution_date": request.user.date_joined.date(),
            "completed_lessons": completed_lessons,
            "exercise_attempts": exercise_attempts,
            "help_requests": help_requests,
            "contribution_streak": completed_lessons,
        })
class QuizAttemptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        question_id = request.data.get("question_id")
        question_text = request.data.get("question_text", "")
        selected_answer = request.data.get("selected_answer")
        correct_answer = request.data.get("correct_answer")
        is_correct = request.data.get("is_correct", False)
        time_taken_seconds = request.data.get("time_taken_seconds", 0)

        if not question_id:
            return Response(
                {"error": "question_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if selected_answer is None:
            return Response(
                {"error": "selected_answer is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if correct_answer is None:
            return Response(
                {"error": "correct_answer is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        attempt = QuizAttempt.objects.create(
            user=request.user,
            question_id=question_id,
            question_text=question_text,
            selected_answer=selected_answer,
            correct_answer=correct_answer,
            is_correct=is_correct,
            time_taken_seconds=time_taken_seconds,
        )

        return Response({
            "id": attempt.id,
            "question_id": attempt.question_id,
            "is_correct": attempt.is_correct,
            "created_at": attempt.created_at,
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        attempts = QuizAttempt.objects.filter(user=request.user)

        question_id = request.query_params.get("question_id")
        if question_id:
            attempts = attempts.filter(question_id=question_id)

        total = attempts.count()
        correct = attempts.filter(is_correct=True).count()
        incorrect = total - correct

        return Response({
            "total_attempts": total,
            "correct": correct,
            "incorrect": incorrect,
            "accuracy_percent": round((correct / total) * 100, 1) if total > 0 else 0,
            "attempts": list(attempts.values(
                "id", "question_id", "question_text",
                "selected_answer", "correct_answer",
                "is_correct", "time_taken_seconds", "created_at"
            ))
        })
