from apps.content.models import Lesson
from apps.content.serializers import LessonSerializer
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Min, Sum
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import permissions, status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .models import (
    Badge,
    Certificate,
    ExerciseAttempt,
    HelpRequest,
    LessonProgress,
    QuizAttempt,
)
from .serializers import (
    BadgeSerializer,
    BulkSyncSerializer,
    CertificateVerificationSerializer,
    HelpRequestSerializer,
    LessonProgressCreateSerializer,
    LessonProgressSerializer,
    QuizAttemptSerializer,
)
from .throttles import HelpRequestRateThrottle


@extend_schema(responses=BadgeSerializer(many=True))
class BadgeListView(ListAPIView):
    queryset = Badge.objects.all()
    serializer_class = BadgeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


@extend_schema_view(
    get=extend_schema(responses=LessonProgressSerializer(many=True)),
    post=extend_schema(
        request=LessonProgressCreateSerializer, responses=LessonProgressSerializer
    ),
)
class MyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        progress = LessonProgress.objects.filter(
            user=request.user, organization=request.user.organization
        ).select_related("lesson")
        serializer = LessonProgressSerializer(progress, many=True)
        return Response(serializer.data)

    def post(self, request):
        lesson_slug = request.data.get("lesson_slug")
        from apps.progress.models import XPMultiplierEvent

        multiplier = XPMultiplierEvent.get_active_multiplier()
        base_score = request.data.get("score", 100)
        completed = request.data.get("completed", True)

        try:
            lesson = Lesson.objects.get(
                slug=lesson_slug, organization=request.user.organization
            )
        except Lesson.DoesNotExist:
            lesson = Lesson.objects.create(
                slug=lesson_slug,
                title=lesson_slug.replace("-", " ").title(),
                summary="Dynamic learning module",
                content="Dynamic content loaded from local file storage.",
                difficulty="beginner",
            )

        try:
            progress = LessonProgress.objects.get(user=request.user, lesson=lesson)
            created = False
            if progress.base_score != base_score or progress.completed != completed:
                progress.completed = completed
                progress.base_score = base_score
                progress.multiplier_applied = multiplier
                progress.score = int(base_score * multiplier)
                progress.organization = request.user.organization
                progress.save()
        except LessonProgress.DoesNotExist:
            progress = LessonProgress.objects.create(
                user=request.user,
                lesson=lesson,
                completed=completed,
                base_score=base_score,
                multiplier_applied=multiplier,
                score=int(base_score * multiplier),
                organization=request.user.organization,
            )
            created = True

        from .tasks import evaluate_user_badges_task

        evaluate_user_badges_task.delay(request.user.id)

        serializer = LessonProgressSerializer(progress)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class BulkSyncProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BulkSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        synced = []

        from apps.progress.models import XPMultiplierEvent

        multiplier = XPMultiplierEvent.get_active_multiplier()

        with transaction.atomic():
            for item in serializer.validated_data["lessons"]:

                lesson_slug = item["lesson_slug"]
                base_score = item.get("score", 100)
                completed = item.get("completed", True)

                try:
                    lesson = Lesson.objects.get(slug=lesson_slug)
                except Lesson.DoesNotExist:
                    lesson = Lesson.objects.create(
                        slug=lesson_slug,
                        title=lesson_slug.replace("-", " ").title(),
                        summary="Dynamic learning module",
                        content="Dynamic content loaded from local file storage.",
                        difficulty="beginner",
                    )

                try:
                    progress = LessonProgress.objects.get(
                        user=request.user, lesson=lesson
                    )
                    if (
                        progress.base_score != base_score
                        or progress.completed != completed
                    ):
                        progress.completed = completed
                        progress.base_score = base_score
                        progress.multiplier_applied = multiplier
                        progress.score = int(base_score * multiplier)
                        progress.save()
                except LessonProgress.DoesNotExist:
                    progress = LessonProgress.objects.create(
                        user=request.user,
                        lesson=lesson,
                        completed=completed,
                        base_score=base_score,
                        multiplier_applied=multiplier,
                        score=int(base_score * multiplier),
                    )

                synced.append(progress.id)

            from .tasks import evaluate_user_badges_task

            evaluate_user_badges_task.delay(request.user.id)

        return Response(
            {"synced_count": len(synced), "progress_ids": synced},
            status=status.HTTP_200_OK,
        )


@extend_schema(
    summary="Bulk update lesson progress",
    description="Updates multiple lesson progress states atomically in a single transaction.",
    request=BulkSyncSerializer,
    responses={
        200: OpenApiResponse(
            description="Successful bulk update summary: {success, transaction_outcome, updated_count, updated_ids, metadata}"
        ),
        400: OpenApiResponse(
            description="Validation failures (duplicate entries, invalid lessons, etc.)"
        ),
        500: OpenApiResponse(description="Transaction failures or internal errors"),
    },
)
class BulkProgressUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BulkSyncSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "transaction_outcome": "failed",
                    "validation_failures": serializer.errors,
                    "updated_count": 0,
                    "updated_ids": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated_data = serializer.validated_data["lessons"]

        # Check for duplicate entries within the same request
        seen_slugs = set()
        duplicates = set()
        for item in validated_data:
            slug = item["lesson_slug"]
            if slug in seen_slugs:
                duplicates.add(slug)
            seen_slugs.add(slug)

        if duplicates:
            return Response(
                {
                    "success": False,
                    "transaction_outcome": "failed",
                    "validation_failures": {"duplicate_entries": list(duplicates)},
                    "updated_count": 0,
                    "updated_ids": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        success_ids = []
        missing_slugs = []
        try:
            with transaction.atomic():
                lesson_slugs = list(seen_slugs)
                existing_lessons = {
                    lesson.slug: lesson
                    for lesson in Lesson.objects.filter(slug__in=lesson_slugs)
                }

                # Validation: Invalid lesson IDs
                missing_slugs = [
                    slug for slug in lesson_slugs if slug not in existing_lessons
                ]

                if missing_slugs:
                    # rollback transaction if anything fails validation
                    raise ValueError(f"Invalid lesson IDs: {missing_slugs}")

                existing_progress = {
                    progress.lesson_id: progress
                    for progress in LessonProgress.objects.filter(
                        user=request.user, lesson__slug__in=lesson_slugs
                    )
                }

                progress_to_create = []
                progress_to_update = []

                from apps.progress.models import XPMultiplierEvent

                multiplier = XPMultiplierEvent.get_active_multiplier()

                for item in validated_data:
                    lesson = existing_lessons[item["lesson_slug"]]
                    completed = item.get("completed", True)
                    base_score = item.get("score", 100)

                    if lesson.id in existing_progress:
                        prog = existing_progress[lesson.id]
                        if prog.base_score != base_score or prog.completed != completed:
                            prog.completed = completed
                            prog.base_score = base_score
                            prog.multiplier_applied = multiplier
                            prog.score = int(base_score * multiplier)
                            progress_to_update.append(prog)
                    else:
                        progress_to_create.append(
                            LessonProgress(
                                user=request.user,
                                lesson=lesson,
                                completed=completed,
                                base_score=base_score,
                                multiplier_applied=multiplier,
                                score=int(base_score * multiplier),
                            )
                        )

                if progress_to_create:
                    created_progresses = LessonProgress.objects.bulk_create(
                        progress_to_create
                    )
                    success_ids.extend([p.id for p in created_progresses])

                if progress_to_update:
                    LessonProgress.objects.bulk_update(
                        progress_to_update,
                        ["completed", "score", "base_score", "multiplier_applied"],
                    )
                    success_ids.extend([p.id for p in progress_to_update])

                from .tasks import evaluate_user_badges_task

                evaluate_user_badges_task.delay(request.user.id)

        except ValueError as ve:
            return Response(
                {
                    "success": False,
                    "transaction_outcome": "rolled_back",
                    "validation_failures": {"invalid_lessons": missing_slugs},
                    "updated_count": 0,
                    "updated_ids": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "transaction_outcome": "rolled_back",
                    "validation_failures": {"exception": str(e)},
                    "updated_count": 0,
                    "updated_ids": [],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "transaction_outcome": "committed",
                "validation_failures": {},
                "updated_count": len(success_ids),
                "updated_ids": success_ids,
                "metadata": {
                    "synced_at": request.data.get("metadata", {}).get("timestamp", None)
                },
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(
    responses=OpenApiResponse(
        description="Community stats summary JSON: active_contributors, merged_prs, response_sla, open_requests"
    )
)
class CommunityStatsView(APIView):
    def get(self, request):
        from django.contrib.auth.models import User

        user_count = User.objects.count()
        completed_lessons = LessonProgress.objects.filter(
            organization=request.user.organization,
            completed=True,
        ).count()

        open_help_requests = HelpRequest.objects.filter(
            organization=request.user.organization,
            status=HelpRequest.Status.OPEN,
        ).count()
        active_contributors = 100 + user_count
        merged_prs = 300 + completed_lessons

        return Response(
            {
                "active_contributors": active_contributors,
                "merged_prs": merged_prs,
                "response_sla": "3.5h",
                "open_requests": open_help_requests,
            }
        )


class UserAchievementsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        completed_lessons = LessonProgress.objects.filter(
            user=request.user, completed=True
        ).count()

        exercises_completed = ExerciseAttempt.objects.filter(
            user=request.user, is_correct=True
        ).count()

        help_requests = HelpRequest.objects.filter(user=request.user).count()

        badges = []

        if completed_lessons >= 1:
            badges.append(
                {
                    "name": "First Contribution",
                    "description": "Completed your first lesson",
                }
            )

        if completed_lessons >= 5:
            badges.append(
                {"name": "Consistent Learner", "description": "Completed 5 lessons"}
            )

        if completed_lessons >= 10:
            badges.append(
                {"name": "Knowledge Explorer", "description": "Completed 10 lessons"}
            )

        if exercises_completed >= 5:
            badges.append(
                {"name": "Challenge Solver", "description": "Solved 5 exercises"}
            )

        if help_requests >= 3:
            badges.append(
                {"name": "Community Helper", "description": "Created 3 help requests"}
            )

        return Response({"earned_badges": badges})


@extend_schema_view(
    get=extend_schema(responses=HelpRequestSerializer(many=True)),
    post=extend_schema(request=HelpRequestSerializer, responses=HelpRequestSerializer),
)
class HelpRequestListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [HelpRequestRateThrottle()]
        return []

    def get(self, request):
        help_requests = HelpRequest.objects.filter(
            user=request.user,
            organization=request.user.organization,
        ).select_related("lesson")
        serializer = HelpRequestSerializer(help_requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        lesson_slug = request.data.get("lesson_slug")
        message = request.data.get("message", "").strip()

        if not lesson_slug:
            return Response(
                {"error": "lesson_slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not message:
            return Response(
                {"error": "message is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lesson = Lesson.objects.get(
                slug=lesson_slug,
                organization=request.user.organization,
            )
        except Lesson.DoesNotExist:
            return Response(
                {"error": "Lesson not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        help_request = HelpRequest.objects.create(
            user=request.user,
            lesson=lesson,
            message=message,
            organization=request.user.organization,
        )

        serializer = HelpRequestSerializer(help_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IsMentor(BasePermission):
    """
    Grants access only to users who have a MentorProfile.

    This permission is intentionally separate from `is_staff` so that
    regular staff administrators are not automatically treated as mentors,
    and mentors do not need elevated Django permissions.
    """

    message = "You must be a designated mentor to access this resource."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and hasattr(request.user, "mentor_profile"))


class MentorHelpRequestListView(ListAPIView):
    """
    Read-only list of HelpRequest tickets scoped to the requesting mentor's
    assigned lessons.

    Only users with a MentorProfile may access this endpoint. The queryset
    is automatically filtered so a mentor can never see tickets outside their
    assigned module scope.

    GET /api/progress/mentor/help-requests/
    """

    serializer_class = HelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsMentor]

    def get_queryset(self):
        assigned = self.request.user.mentor_profile.assigned_lessons.all()
        return (
            HelpRequest.objects.filter(lesson__in=assigned)
            .select_related("user", "lesson")
            .order_by("-created_at")
        )


@extend_schema(
    responses=OpenApiResponse(
        description="Contributor timeline: first_contribution_date, completed_lessons, exercise_attempts, help_requests, contribution_streak"
    )
)
class ContributorTimelineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        completed_lessons = LessonProgress.objects.filter(
            user=request.user, completed=True
        ).count()

        exercise_attempts = ExerciseAttempt.objects.filter(user=request.user).count()

        help_requests = HelpRequest.objects.filter(user=request.user).count()

        return Response(
            {
                "first_contribution_date": request.user.date_joined.date(),
                "completed_lessons": completed_lessons,
                "exercise_attempts": exercise_attempts,
                "help_requests": help_requests,
                "contribution_streak": completed_lessons,
            }
        )


@extend_schema_view(
    post=extend_schema(
        description="Create a quiz attempt. Expected JSON fields: question_id, question_text (optional), selected_answer, correct_answer, is_correct, time_taken_seconds.",
        responses=OpenApiResponse(
            description="Created attempt summary: {id, question_id, is_correct, created_at}"
        ),
    ),
    get=extend_schema(
        description="List quiz attempts and stats. Optional query param: question_id. Returns total_attempts, correct, incorrect, accuracy_percent, attempts array.",
        responses=OpenApiResponse(
            description="Quiz attempts summary and attempts array."
        ),
    ),
)
class QuizAttemptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = QuizAttemptSerializer(data=request.data)
        if serializer.is_valid():
            attempt = serializer.save(user=request.user)
            return Response(
                {
                    "id": attempt.id,
                    "question_id": attempt.question_id,
                    "is_correct": attempt.is_correct,
                    "created_at": attempt.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
                status=status.HTTP_201_CREATED,
            )
        # If there are field errors, extract the first one generically to match typical client expectations
        # Or return all errors. DRF will return a dict like {"selected_answer": ["This field is required."]}
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        attempts = QuizAttempt.objects.filter(user=request.user)

        question_id = request.query_params.get("question_id")
        if question_id:
            attempts = attempts.filter(question_id=question_id)

        total = attempts.count()
        correct = attempts.filter(is_correct=True).count()
        incorrect = total - correct

        return Response(
            {
                "total_attempts": total,
                "correct": correct,
                "incorrect": incorrect,
                "accuracy_percent": (
                    round((correct / total) * 100, 1) if total > 0 else 0
                ),
                "attempts": QuizAttemptSerializer(attempts, many=True).data,
            }
        )


class CertificateVerificationThrottle(AnonRateThrottle):
    rate = "10/minute"


@extend_schema(responses=CertificateVerificationSerializer)
class CertificateVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [CertificateVerificationThrottle]

    def get(self, request, hash):
        try:
            certificate = Certificate.objects.get(verification_hash=hash)
        except Certificate.DoesNotExist:
            return Response(
                {"is_valid": False, "error": "Certificate not found or invalid hash."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CertificateVerificationSerializer(certificate)
        if not certificate.is_active:
            return Response(
                {
                    "is_valid": False,
                    "error": "This certificate has been revoked or deactivated.",
                    "certificate": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {"is_valid": True, "certificate": serializer.data},
            status=status.HTTP_200_OK,
        )


class MyCertificateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        certificate = Certificate.objects.filter(user=request.user).first()
        if certificate:
            serializer = CertificateVerificationSerializer(certificate)
            return Response(
                {"has_certificate": True, "certificate": serializer.data},
                status=status.HTTP_200_OK,
            )

        completed_lessons = LessonProgress.objects.filter(
            user=request.user, completed=True
        ).count()
        total_lessons = Lesson.objects.count()

        if total_lessons > 0 and completed_lessons >= total_lessons:
            certificate = Certificate.objects.create(
                user=request.user, course_name="Open Source Contribution Course"
            )
            serializer = CertificateVerificationSerializer(certificate)
            return Response(
                {"has_certificate": True, "certificate": serializer.data},
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "has_certificate": False,
                "detail": "Course requirements not met. Complete all lessons to unlock.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


@extend_schema(responses=LessonSerializer(many=True))
class RecommendationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        total_lessons_info = Lesson.objects.values("category").annotate(
            total=Count("id"), min_order=Min("order")
        )
        total_map = {
            item["category"]: {"total": item["total"], "min_order": item["min_order"]}
            for item in total_lessons_info
        }

        completed_progress = LessonProgress.objects.filter(user=user, completed=True)
        completed_lessons_per_category = completed_progress.values(
            "lesson__category"
        ).annotate(completed=Count("id"))
        completed_map = {
            item["lesson__category"]: item["completed"]
            for item in completed_lessons_per_category
        }

        category_rates = []
        for category, info in total_map.items():
            completed = completed_map.get(category, 0)
            total = info["total"]
            min_order = info["min_order"]
            rate = completed / total if total > 0 else 0

            if rate < 1.0:
                category_rates.append(
                    {"category": category, "rate": rate, "min_order": min_order}
                )

        if not category_rates:
            return Response([])

        category_rates.sort(key=lambda x: (-x["rate"], x["min_order"]))
        top_category = category_rates[0]["category"]

        completed_lesson_ids = completed_progress.values_list("lesson_id", flat=True)
        recommended_lessons = (
            Lesson.objects.filter(category=top_category)
            .exclude(id__in=completed_lesson_ids)
            .order_by("order")
        )

        serializer = LessonSerializer(recommended_lessons, many=True)
        return Response(serializer.data)


from .models import CodeSubmission, PeerReview
from .serializers import CodeSubmissionSerializer, PeerReviewSerializer


from apps.content.models import Exercise
from apps.progress.models import ExerciseAttempt
import random


class CodeSubmissionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        submissions = CodeSubmission.objects.filter(
            status=CodeSubmission.Status.PENDING_REVIEW, assigned_reviewers=request.user
        )
        serializer = CodeSubmissionSerializer(submissions, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CodeSubmissionSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                submission = serializer.save(
                    user=request.user, status=CodeSubmission.Status.PENDING_REVIEW
                )
                if submission.exercise:
                    eligible_users = list(
                        User.objects.filter(
                            exerciseattempt__exercise=submission.exercise,
                            exerciseattempt__is_correct=True,
                        )
                        .exclude(id=request.user.id)
                        .distinct()
                    )
                    if len(eligible_users) >= 2:
                        assigned = random.sample(eligible_users, 2)
                        submission.assigned_reviewers.set(assigned)
                    elif len(eligible_users) == 1:
                        submission.assigned_reviewers.set(eligible_users)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PeerReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, submission_id):
        submission = get_object_or_404(CodeSubmission, id=submission_id)

        if submission.user == request.user:
            return Response(
                {"error": "Cannot review your own submission"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not submission.assigned_reviewers.filter(id=request.user.id).exists():
            return Response(
                {"error": "You are not assigned to review this submission"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if PeerReview.objects.filter(
            submission=submission, reviewer=request.user
        ).exists():
            return Response(
                {"error": "You have already reviewed this submission"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PeerReviewSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                review = serializer.save(
                    submission=submission, reviewer=request.user, points_earned=10
                )

                # Check consensus
                reviews = PeerReview.objects.filter(submission=submission)
                if reviews.count() >= 2:
                    approvals = sum(1 for r in reviews if r.is_approved)
                    if approvals == 2:
                        submission.status = CodeSubmission.Status.REVIEWED
                        if submission.exercise:
                            ExerciseAttempt.objects.create(
                                user=submission.user,
                                exercise=submission.exercise,
                                submitted_command="Peer Reviewed Solution",
                                is_correct=True,
                            )
                    elif approvals == 1:
                        submission.status = CodeSubmission.Status.ESCALATED
                    else:
                        submission.status = CodeSubmission.Status.CHANGES_REQUESTED
                    submission.save(update_fields=["status"])

                return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


import csv
from django.http import StreamingHttpResponse
from django.db.models import Max, Q, Count, Sum, OuterRef, Subquery, IntegerField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from apps.dashboard.models import Issue, StreakFreeze


class Echo:
    """An object that implements just the write method of the file-like interface."""

    def write(self, value):
        return value


class ExportProgressCSVView(APIView):
    """
    Export user progress reports as a downloadable CSV file.
    Streams the response to handle large datasets efficiently.
    Only accessible to staff/admin users.
    """

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        def get_streak_info(user, today, join_date):
            activity_days = set()
            for attempt in user.exerciseattempt_set.all():
                activity_days.add(timezone.localdate(attempt.created_at))
            for prog in user.lessonprogress_set.all():
                if prog.completed:
                    activity_days.add(timezone.localdate(prog.updated_at))

            freezes_by_date = {}
            unused_freezes = 0
            for freeze in user.streak_freezes.all():
                if freeze.used_on_date:
                    freezes_by_date[freeze.used_on_date] = True
                else:
                    unused_freezes += 1

            streak_days = 0
            highest_streak = 0
            current_day = today
            current_streak = 0
            is_current = True

            # Sort activity days to calculate highest streak
            all_dates = sorted(list(activity_days) + list(freezes_by_date.keys()))
            if all_dates:
                temp_streak = 1
                for i in range(1, len(all_dates)):
                    if (all_dates[i] - all_dates[i - 1]).days == 1:
                        temp_streak += 1
                    elif (all_dates[i] - all_dates[i - 1]).days > 1:
                        if temp_streak > highest_streak:
                            highest_streak = temp_streak
                        temp_streak = 1
                if temp_streak > highest_streak:
                    highest_streak = temp_streak

            # Calculate current streak
            temp_unused_freezes = unused_freezes
            while current_day >= join_date:
                if current_day in activity_days or current_day in freezes_by_date:
                    current_streak += 1
                elif current_day == today:
                    pass  # Today hasn't ended, doesn't break streak
                else:
                    if temp_unused_freezes > 0:
                        current_streak += 1
                        temp_unused_freezes -= 1
                    else:
                        break
                current_day -= timedelta(days=1)

            if current_streak > highest_streak:
                highest_streak = current_streak

            return current_streak, highest_streak

        def csv_generator():
            yield [
                "Username",
                "Email",
                "Completed Modules",
                "Completed Challenges",
                "XP Earned",
                "Current Learning Streak",
                "Highest Streak",
                "Completion Percentage",
                "Last Active Date",
                "Account Creation Date",
            ]

            lesson_xp = (
                LessonProgress.objects.filter(user=OuterRef("pk"), completed=True)
                .values("user")
                .annotate(total=Sum("score"))
                .values("total")
            )
            issues_xp = (
                Issue.objects.filter(
                    assigned_to=OuterRef("pk"), status=Issue.Status.SOLVED
                )
                .values("assigned_to")
                .annotate(total=Sum("points") + Sum("bonus_points"))
                .values("total")
            )
            last_active = (
                LessonProgress.objects.filter(user=OuterRef("pk"))
                .values("user")
                .annotate(latest=Max("updated_at"))
                .values("latest")
            )

            total_lessons = Lesson.objects.count()
            today = timezone.localdate(timezone.now())

            users = (
                User.objects.filter(is_staff=False)
                .annotate(
                    completed_modules=Count(
                        "lessonprogress",
                        filter=Q(lessonprogress__completed=True),
                        distinct=True,
                    ),
                    completed_challenges=Count(
                        "exerciseattempt",
                        filter=Q(exerciseattempt__is_correct=True),
                        distinct=True,
                    ),
                    u_lxp=Coalesce(
                        Subquery(lesson_xp, output_field=IntegerField()), Value(0)
                    ),
                    u_ixp=Coalesce(
                        Subquery(issues_xp, output_field=IntegerField()), Value(0)
                    ),
                    last_active_date=Subquery(last_active),
                )
                .prefetch_related(
                    "exerciseattempt_set", "lessonprogress_set", "streak_freezes"
                )
                .iterator(chunk_size=500)
            )

            for user in users:
                xp_earned = user.u_lxp + user.u_ixp
                completion_percentage = (
                    int((user.completed_modules / total_lessons) * 100)
                    if total_lessons > 0
                    else 0
                )
                join_date = timezone.localdate(user.date_joined)

                current_streak, highest_streak = get_streak_info(user, today, join_date)

                last_active_str = (
                    user.last_active_date.strftime("%Y-%m-%d %H:%M")
                    if user.last_active_date
                    else "N/A"
                )
                creation_date_str = user.date_joined.strftime("%Y-%m-%d %H:%M")

                yield [
                    user.username,
                    user.email,
                    str(user.completed_modules),
                    str(user.completed_challenges),
                    str(xp_earned),
                    str(current_streak),
                    str(highest_streak),
                    f"{completion_percentage}%",
                    last_active_str,
                    creation_date_str,
                ]

        writer = csv.writer(Echo())
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in csv_generator()), content_type="text/csv"
        )
        response["Content-Disposition"] = (
            'attachment; filename="user_progress_report.csv"'
        )
        return response


class UserAchievementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.progress.models import UserAchievement

        achievements = UserAchievement.objects.filter(user=request.user).select_related(
            "achievement"
        )
        data = [
            {
                "id": ua.id,
                "achievement_id": ua.achievement.id,
                "name": ua.achievement.name,
                "description": ua.achievement.description,
                "icon": ua.achievement.icon_name,
                "earned_at": ua.earned_at,
            }
            for ua in achievements
        ]
        return Response(data)
