from rest_framework import generics, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import BurnoutMetric, BurnoutSignal, ContributorActivity, Intervention
from .serializers import (
    BurnoutMetricSerializer,
    BurnoutSignalSerializer,
    ContributorActivitySerializer,
    InterventionSerializer,
    UserWeeklyBurnoutTrendsResponseSerializer,
)


class ContributorActivityViewSet(viewsets.ModelViewSet):
    queryset = ContributorActivity.objects.all()
    serializer_class = ContributorActivitySerializer
    permission_classes = [IsAuthenticated]


class BurnoutSignalViewSet(viewsets.ModelViewSet):
    queryset = BurnoutSignal.objects.all()
    serializer_class = BurnoutSignalSerializer
    permission_classes = [IsAuthenticated]


class InterventionViewSet(viewsets.ModelViewSet):
    queryset = Intervention.objects.all()
    serializer_class = InterventionSerializer
    permission_classes = [IsAuthenticated]


class BurnoutMetricViewSet(viewsets.ModelViewSet):
    queryset = BurnoutMetric.objects.all()
    serializer_class = BurnoutMetricSerializer
    permission_classes = [IsAuthenticated]


class UserWeeklyBurnoutTrendsView(generics.GenericAPIView):
    """
    Exposes weekly burnout score trends and activity patterns for a user.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserWeeklyBurnoutTrendsResponseSerializer

    def get(self, request):
        from datetime import timedelta

        from django.contrib.auth import get_user_model
        from django.utils import timezone

        from .models import BurnoutActivityDay, BurnoutSignal

        User = get_user_model()
        target_user = request.user

        user_id_param = request.query_params.get("user_id")
        if user_id_param and request.user.is_staff:
            try:
                target_user = User.objects.get(pk=user_id_param)
            except (User.DoesNotExist, ValueError):
                return Response(
                    {"error": "User not found."}, status=status.HTTP_404_NOT_FOUND
                )

        try:
            weeks_count = int(request.query_params.get("weeks", 8))
            weeks_count = max(1, min(weeks_count, 52))
        except (ValueError, TypeError):
            weeks_count = 8

        today = timezone.now().date()
        weekly_trends = []

        for i in range(weeks_count - 1, -1, -1):
            week_end = today - timedelta(days=i * 7)
            week_start = week_end - timedelta(days=6)

            days = BurnoutActivityDay.objects.filter(
                user=target_user, date__gte=week_start, date__lte=week_end
            )
            total_hours = sum(d.active_hours for d in days)
            active_days = days.count()
            avg_daily_hours = round(total_hours / 7.0, 2)

            signals = BurnoutSignal.objects.filter(
                user=target_user,
                detected_at__date__gte=week_start,
                detected_at__date__lte=week_end,
            ).count()

            score = 0.0
            if avg_daily_hours > 6.0:
                score += 40.0
            elif avg_daily_hours > 4.0:
                score += 25.0
            elif avg_daily_hours > 2.0:
                score += 10.0

            if active_days >= 7:
                score += 30.0
            elif active_days >= 6:
                score += 15.0

            score += min(30.0, signals * 10.0)
            score = round(min(100.0, max(0.0, score)), 1)

            if score >= 80.0:
                risk = "critical"
            elif score >= 60.0:
                risk = "high"
            elif score >= 40.0:
                risk = "medium"
            else:
                risk = "low"

            weekly_trends.append(
                {
                    "week_start": week_start,
                    "week_end": week_end,
                    "week_number": weeks_count - i,
                    "total_active_hours": round(total_hours, 2),
                    "average_daily_hours": avg_daily_hours,
                    "active_days_count": active_days,
                    "burnout_score": score,
                    "burnout_risk": risk,
                    "signals_count": signals,
                    "trend_direction": "stable",
                }
            )

        for idx in range(len(weekly_trends)):
            if idx == 0:
                weekly_trends[idx]["trend_direction"] = "stable"
            else:
                delta = (
                    weekly_trends[idx]["burnout_score"]
                    - weekly_trends[idx - 1]["burnout_score"]
                )
                if delta > 5.0:
                    weekly_trends[idx]["trend_direction"] = "deteriorating"
                elif delta < -5.0:
                    weekly_trends[idx]["trend_direction"] = "improving"
                else:
                    weekly_trends[idx]["trend_direction"] = "stable"

        latest_point = weekly_trends[-1] if weekly_trends else None
        first_point = weekly_trends[0] if weekly_trends else None

        overall_trend = "stable"
        if latest_point and first_point and len(weekly_trends) > 1:
            total_delta = latest_point["burnout_score"] - first_point["burnout_score"]
            if total_delta > 10.0:
                overall_trend = "worsening"
            elif total_delta < -10.0:
                overall_trend = "improving"

        response_data = {
            "user_id": target_user.id,
            "username": target_user.username,
            "weeks_analyzed": weeks_count,
            "current_score": latest_point["burnout_score"] if latest_point else 0.0,
            "current_risk": latest_point["burnout_risk"] if latest_point else "low",
            "overall_trend": overall_trend,
            "weekly_trends": weekly_trends,
        }

        return Response(response_data, status=status.HTTP_200_OK)
