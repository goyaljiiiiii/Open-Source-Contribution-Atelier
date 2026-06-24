from apps.content.models import Lesson
from apps.dashboard.models import Issue, PullRequest
from apps.progress.models import ExerciseAttempt, LessonProgress
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models
from django.db.models import (Count, F, IntegerField, OuterRef, Subquery, Sum,
                              Value)
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView


class LeaderboardPagination(PageNumberPagination):
    page_size = 20


class LeaderboardSerializer(serializers.ModelSerializer):
    prs_merged = serializers.IntegerField(read_only=True)
    issues_solved = serializers.IntegerField(read_only=True)
    xp = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "prs_merged", "issues_solved", "xp")


class LeaderboardView(ListAPIView):
    """
    Paginated contributor leaderboard ordered by total XP.
    """

    serializer_class = LeaderboardSerializer
    pagination_class = LeaderboardPagination

    def get_queryset(self):
        timeframe = self.request.query_params.get("timeframe", "all")
        now = timezone.now()
        start_date = None

        if timeframe == "daily":
            start_date = now - timedelta(days=1)
        elif timeframe == "weekly":
            start_date = now - timedelta(days=7)
        elif timeframe == "monthly":
            start_date = now - timedelta(days=30)

        lesson_progress_filter = {"user": OuterRef("pk"), "completed": True}
        issue_filter = {"assigned_to": OuterRef("pk"), "status": Issue.Status.SOLVED}
        pr_filter = {"user": OuterRef("pk"), "status": PullRequest.Status.MERGED}

        if start_date:
            lesson_progress_filter["updated_at__gte"] = start_date
            issue_filter["updated_at__gte"] = start_date
            pr_filter["updated_at__gte"] = start_date

        lesson_xp = (
            LessonProgress.objects.filter(**lesson_progress_filter)
            .values("user")
            .annotate(total=Sum("score"))
            .values("total")
        )

        issues_xp = (
            Issue.objects.filter(**issue_filter)
            .values("assigned_to")
            .annotate(total=Sum("points") + Sum("bonus_points"))
            .values("total")
        )

        prs_merged = (
            PullRequest.objects.filter(**pr_filter)
            .values("user")
            .annotate(total=Count("id"))
            .values("total")
        )

        issues_solved = (
            Issue.objects.filter(**issue_filter)
            .values("assigned_to")
            .annotate(total=Count("id"))
            .values("total")
        )

        return (
            User.objects.filter(is_staff=False)
            .annotate(
                prs_merged=Coalesce(
                    Subquery(prs_merged, output_field=IntegerField()), Value(0)
                ),
                issues_solved=Coalesce(
                    Subquery(issues_solved, output_field=IntegerField()), Value(0)
                ),
                lesson_xp=Coalesce(
                    Subquery(lesson_xp, output_field=IntegerField()), Value(0)
                ),
                issues_xp=Coalesce(
                    Subquery(issues_xp, output_field=IntegerField()), Value(0)
                ),
            )
            .annotate(
                xp=F("lesson_xp") + F("issues_xp"),
            )
            .order_by("-xp", "username", "id")
        )


class AdminDashboardView(APIView):
    """
    API view for Admin Dashboard stats.
    Only users with is_staff=True can access this.
    """

    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        cache_key = "dashboard_admin_stats_v2"
        data = cache.get(cache_key)

        if data is None:
            # 1. Calculate system-wide stats
            total_issues = Issue.objects.count()
            solved_issues = Issue.objects.filter(status=Issue.Status.SOLVED).count()
            open_issues = Issue.objects.filter(status=Issue.Status.OPEN).count()
            in_progress_issues = Issue.objects.filter(
                status=Issue.Status.IN_PROGRESS
            ).count()

            total_prs = PullRequest.objects.count()
            merged_prs = PullRequest.objects.filter(
                status=PullRequest.Status.MERGED
            ).count()
            pending_prs_count = PullRequest.objects.filter(
                status=PullRequest.Status.OPEN
            ).count()
            closed_prs = PullRequest.objects.filter(
                status=PullRequest.Status.CLOSED
            ).count()

            active_contributors = (
                User.objects.filter(is_staff=False)
                .filter(pull_requests__isnull=False)
                .distinct()
                .count()
            )

            system_stats = {
                "total_issues": total_issues,
                "solved_issues": solved_issues,
                "open_issues": open_issues,
                "in_progress_issues": in_progress_issues,
                "total_prs": total_prs,
                "merged_prs": merged_prs,
                "pending_prs": pending_prs_count,
                "closed_prs": closed_prs,
                "active_contributors": active_contributors,
            }

            # 2. Pending PRs queue
            pending_prs_qs = (
                PullRequest.objects.filter(status=PullRequest.Status.OPEN)
                .select_related("user", "issue")
                .order_by("-created_at")
            )

            pending_prs = []
            for pr in pending_prs_qs:
                pending_prs.append(
                    {
                        "id": pr.id,
                        "title": pr.title,
                        "contributor": pr.user.username,
                        "issue_title": pr.issue.title if pr.issue else "No Issue Link",
                        "created_at": pr.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                )

            data = {
                "system_stats": system_stats,
                "pending_prs": pending_prs,
            }

            # Cache for 5 minutes
            cache.set(cache_key, data, 300)

        return Response(data)


class PublicLandingStatsView(APIView):
    """
    Public API view returning summary stats for the landing page.
    No authentication required.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cache_key = "dashboard_public_landing_stats"
        data = cache.get(cache_key)

        if data is None:
            total_users = User.objects.filter(is_staff=False).count()
            total_lessons_solved = LessonProgress.objects.filter(completed=True).count()
            total_xp = (
                LessonProgress.objects.filter(completed=True).aggregate(
                    total=Sum("score")
                )["total"]
                or 0
            )

            data = {
                "total_users": total_users,
                "total_lessons_solved": total_lessons_solved,
                "total_xp": total_xp,
            }

            # Cache for 5 minutes
            cache.set(cache_key, data, 300)

        return Response(data)


class ContributorDashboardView(APIView):
    """
    API view for Contributor Dashboard stats.
    Accessible to any authenticated user.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        cache_key = f"dashboard_contributor_stats_{user.id}"
        data = cache.get(cache_key)

        if data is None:
            # ── 1. Personal stats ─────────────────────────────────────────────
            # Consolidate LessonProgress into a single aggregate query
            lp_agg = LessonProgress.objects.filter(user=user).aggregate(
                total_xp=Coalesce(
                    Sum("score", filter=models.Q(completed=True)),
                    Value(0),
                    output_field=IntegerField(),
                ),
                completed_lessons=Count(
                    "id", filter=models.Q(completed=True)
                ),
            )
            lesson_xp = lp_agg["total_xp"]
            completed_lessons = lp_agg["completed_lessons"]

            # Consolidate Issue queries into a single aggregate query
            issues_agg = Issue.objects.filter(
                assigned_to=user, status=Issue.Status.SOLVED
            ).aggregate(
                issues_solved=Count("id"),
                p_sum=Coalesce(Sum("points"), Value(0), output_field=IntegerField()),
                b_sum=Coalesce(Sum("bonus_points"), Value(0), output_field=IntegerField()),
            )
            issues_solved = issues_agg["issues_solved"]
            issues_xp = issues_agg["p_sum"] + issues_agg["b_sum"]
            total_xp = lesson_xp + issues_xp

            prs_merged = PullRequest.objects.filter(
                user=user, status=PullRequest.Status.MERGED
            ).count()

            # ── Streak ────────────────────────────────────────────────────────
            # Fetch both date sets in one query each; no per-record ORM calls.
            attempt_dates = set(
                ExerciseAttempt.objects.filter(user=user)
                .values_list("created_at", flat=True)
            )
            progress_dates = set(
                LessonProgress.objects.filter(user=user)
                .values_list("updated_at", flat=True)
            )
            activity_days = {timezone.localdate(dt) for dt in attempt_dates} | {
                timezone.localdate(dt) for dt in progress_dates
            }
            streak_days = len(activity_days)

            # ── Rank — single annotated queryset (was N+1 loop) ───────────────
            # Two subqueries executed once by the database; no Python loop.
            lesson_xp_sub = (
                LessonProgress.objects.filter(
                    user=OuterRef("pk"), completed=True
                )
                .values("user")
                .annotate(total=Sum("score"))
                .values("total")
            )
            issues_xp_sub = (
                Issue.objects.filter(
                    assigned_to=OuterRef("pk"), status=Issue.Status.SOLVED
                )
                .values("assigned_to")
                .annotate(total=Sum("points") + Sum("bonus_points"))
                .values("total")
            )
            ranked_ids = list(
                User.objects.filter(is_staff=False)
                .annotate(
                    l_xp=Coalesce(
                        Subquery(lesson_xp_sub, output_field=IntegerField()),
                        Value(0),
                    ),
                    i_xp=Coalesce(
                        Subquery(issues_xp_sub, output_field=IntegerField()),
                        Value(0),
                    ),
                )
                .annotate(total_xp=F("l_xp") + F("i_xp"))
                .order_by("-total_xp", "id")
                .values_list("id", flat=True)
            )
            rank = ranked_ids.index(user.id) + 1 if user.id in ranked_ids else len(ranked_ids) + 1

            personal_stats = {
                "issues_solved": issues_solved,
                "prs_merged": prs_merged,
                "total_xp": total_xp,
                "streak_days": streak_days,
                "rank": rank,
            }

            # ── 2. Assigned Issues (Open or In Progress) ──────────────────────
            assigned_issues_qs = (
                Issue.objects.filter(assigned_to=user)
                .exclude(status=Issue.Status.SOLVED)
                .only("id", "title", "description", "status", "points", "created_at")
                .order_by("-created_at")
            )

            assigned_issues = [
                {
                    "id": issue.id,
                    "title": issue.title,
                    "description": issue.description,
                    "status": issue.status,
                    "points": issue.points,
                    "created_at": issue.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
                for issue in assigned_issues_qs
            ]

            # ── 3. Recent PRs ─────────────────────────────────────────────────
            recent_prs_qs = (
                PullRequest.objects.filter(user=user)
                .select_related("issue")
                .only(
                    "id", "title", "status", "created_at", "merged_at",
                    "issue__title",
                )
                .order_by("-created_at")[:10]
            )

            recent_prs = [
                {
                    "id": pr.id,
                    "title": pr.title,
                    "status": pr.status,
                    "issue_title": pr.issue.title if pr.issue else "No Issue Link",
                    "created_at": pr.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "merged_at": (
                        pr.merged_at.strftime("%Y-%m-%dT%H:%M:%SZ")
                        if pr.merged_at
                        else None
                    ),
                }
                for pr in recent_prs_qs
            ]

            # ── 4. Progress tracker ───────────────────────────────────────────
            # `completed_lessons` was already computed above — no extra query.
            total_lessons = Lesson.objects.count()
            completion_percentage = (
                int((completed_lessons / total_lessons) * 100)
                if total_lessons > 0
                else 0
            )

            progress_tracker = {
                "completed_lessons": completed_lessons,
                "total_lessons": total_lessons,
                "completion_percentage": completion_percentage,
            }

            data = {
                "personal_stats": personal_stats,
                "assigned_issues": assigned_issues,
                "recent_prs": recent_prs,
                "progress_tracker": progress_tracker,
            }

            # Cache for 5 minutes
            cache.set(cache_key, data, 300)

        return Response(data)
