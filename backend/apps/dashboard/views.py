from apps.content.models import Lesson
from apps.dashboard.models import Issue, PullRequest, StreakFreeze
from apps.progress.models import ExerciseAttempt, LessonProgress
from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import (Count, F, IntegerField, OuterRef, Subquery, Sum,
                              Value)
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, serializers
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView


from rest_framework.pagination import CursorPagination

class LeaderboardPagination(CursorPagination):
    page_size = 20
    ordering = ("-xp", "username", "id")


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

    Results are cached per-page in Redis for 5 minutes, since the
    underlying query involves several correlated subqueries across
    LessonProgress, Issue, and PullRequest and is expensive to
    recompute on every request.
    """

    serializer_class = LeaderboardSerializer
    pagination_class = LeaderboardPagination

    def list(self, request, *args, **kwargs):
        page_number = request.query_params.get("page", "1")
        cache_key = f"leaderboard_page_{page_number}"
        data = cache.get(cache_key)

        if data is None:
            response = super().list(request, *args, **kwargs)
            data = response.data
            # Cache for 5 minutes
            cache.set(cache_key, data, 300)
            return Response(data)

        return Response(data)

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
            .annotate(total=Sum("points"))
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
            # 1. Personal stats
            issues_solved = Issue.objects.filter(
                assigned_to=user, status=Issue.Status.SOLVED
            ).count()
            prs_merged = PullRequest.objects.filter(
                user=user, status=PullRequest.Status.MERGED
            ).count()

            lesson_xp = (
                LessonProgress.objects.filter(user=user, completed=True).aggregate(
                    total=Sum("score")
                )["total"]
                or 0
            )
            issues_xp = (
                Issue.objects.filter(
                    assigned_to=user, status=Issue.Status.SOLVED
                ).aggregate(total=Sum("points"))["total"]
                or 0
            )
            total_xp = lesson_xp + issues_xp

            spent_points = (
                StreakFreeze.objects.filter(user=user).aggregate(total=Sum("cost"))["total"]
                or 0
            )
            available_points = total_xp - spent_points

            # Calculate streak based on unique days of activity (attempts or completed lessons)
            activity_days = set()
            attempts = ExerciseAttempt.objects.filter(user=user).values_list(
                "created_at", flat=True
            )
            for dt in attempts:
                activity_days.add(timezone.localdate(dt))
            progress_entries = LessonProgress.objects.filter(user=user).values_list(
                "updated_at", flat=True
            )
            for dt in progress_entries:
                activity_days.add(timezone.localdate(dt))

            # Include days bridged by a streak freeze
            used_freezes = StreakFreeze.objects.filter(user=user, used_on_date__isnull=False).values_list("used_on_date", flat=True)
            for d in used_freezes:
                activity_days.add(d)

            # Calculate true consecutive streak
            today = timezone.localdate()
            current_date = today
            streak_days = 0
            join_date = timezone.localdate(user.date_joined)

            # If no activity today, check if streak is still alive from yesterday
            if current_date not in activity_days:
                current_date -= timezone.timedelta(days=1)

            unused_freezes_list = list(StreakFreeze.objects.filter(user=user, used_on_date__isnull=True).order_by("purchased_at"))
            freezes_to_update = []

            while current_date >= join_date:
                if current_date in activity_days:
                    streak_days += 1
                    current_date -= timezone.timedelta(days=1)
                elif unused_freezes_list and current_date < today:
                    # Automatically consume freeze for missed past day
                    freeze = unused_freezes_list.pop(0)
                    freeze.used_on_date = current_date
                    freezes_to_update.append(freeze)
                    activity_days.add(current_date)
                    streak_days += 1
                    current_date -= timezone.timedelta(days=1)
                else:
                    break

            if freezes_to_update:
                StreakFreeze.objects.bulk_update(freezes_to_update, ["used_on_date"])

            unused_freezes_count = StreakFreeze.objects.filter(user=user, used_on_date__isnull=True).count()

            # Determine Rank based on user XP vs others
            all_users = User.objects.filter(is_staff=False)
            user_ranks = []
            for u in all_users:
                u_lxp = (
                    LessonProgress.objects.filter(user=u, completed=True).aggregate(
                        Sum("score")
                    )["score__sum"]
                    or 0
                )
                u_ixp = (
                    Issue.objects.filter(
                        assigned_to=u, status=Issue.Status.SOLVED
                    ).aggregate(Sum("points"))["points__sum"]
                    or 0
                )
                user_ranks.append((u.id, u_lxp + u_ixp))

            user_ranks.sort(key=lambda x: x[1], reverse=True)
            rank = 1
            for index, (uid, u_xp) in enumerate(user_ranks):
                if uid == user.id:
                    rank = index + 1
                    break

            personal_stats = {
                "issues_solved": issues_solved,
                "prs_merged": prs_merged,
                "total_xp": total_xp,
                "available_points": available_points,
                "unused_freezes": unused_freezes_count,
                "streak_days": streak_days,
                "rank": rank,
            }

            # 2. Assigned Issues (Open or In Progress)
            assigned_issues_qs = (
                Issue.objects.filter(assigned_to=user)
                .exclude(status=Issue.Status.SOLVED)
                .order_by("-created_at")
            )

            assigned_issues = []
            for issue in assigned_issues_qs:
                assigned_issues.append(
                    {
                        "id": issue.id,
                        "title": issue.title,
                        "description": issue.description,
                        "status": issue.status,
                        "points": issue.points,
                        "created_at": issue.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                )

            # 3. Recent PRs
            recent_prs_qs = (
                PullRequest.objects.filter(user=user)
                .select_related("issue")
                .order_by("-created_at")[:10]
            )

            recent_prs = []
            for pr in recent_prs_qs:
                recent_prs.append(
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
                )

            # 4. Progress tracker
            completed_lessons = LessonProgress.objects.filter(
                user=user, completed=True
            ).count()
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


from drf_spectacular.utils import extend_schema
from rest_framework import status
from django.db import transaction

class BuyStreakFreezeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={201: {"type": "object", "properties": {"success": {"type": "boolean"}, "message": {"type": "string"}, "available_points": {"type": "integer"}}}})
    def post(self, request):
        user = request.user
        
        with transaction.atomic():
            lesson_xp = LessonProgress.objects.filter(user=user, completed=True).aggregate(total=Sum("score"))["total"] or 0
            issues_xp = Issue.objects.filter(assigned_to=user, status=Issue.Status.SOLVED).aggregate(total=Sum("points"))["total"] or 0
            total_xp = lesson_xp + issues_xp
            
            spent_points = StreakFreeze.objects.filter(user=user).aggregate(total=Sum("cost"))["total"] or 0
            available_points = total_xp - spent_points
            
            FREEZE_COST = 100
            
            if available_points < FREEZE_COST:
                return Response({"success": False, "message": "Not enough points to buy a streak freeze."}, status=status.HTTP_400_BAD_REQUEST)
                
            unused_freezes = StreakFreeze.objects.filter(user=user, used_on_date__isnull=True).count()
            if unused_freezes >= 3:
                return Response({"success": False, "message": "You can only have up to 3 unused streak freezes at a time."}, status=status.HTTP_400_BAD_REQUEST)
                
            StreakFreeze.objects.create(user=user, cost=FREEZE_COST)
            
            # Invalidate cache for dashboard
            cache.delete(f"dashboard_contributor_stats_{user.id}")
            
            return Response({"success": True, "message": "Streak freeze purchased successfully.", "available_points": available_points - FREEZE_COST}, status=status.HTTP_201_CREATED)
