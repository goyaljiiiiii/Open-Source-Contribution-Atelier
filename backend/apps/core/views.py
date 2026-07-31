from datetime import timedelta

from django.db.models import Avg, Count, Max
from django.utils import timezone
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import PerformanceSample


class PerformanceDashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        seven_days_ago = now - timedelta(days=7)

        qs = PerformanceSample.objects.filter(timestamp__gte=seven_days_ago)

        # DB-agnostic percentiles computation in Python
        hourly_groups = {}
        for sample in qs.values("timestamp", "duration_ms", "db_query_count"):
            hr = sample["timestamp"].replace(minute=0, second=0, microsecond=0)
            if hr not in hourly_groups:
                hourly_groups[hr] = {"durations": [], "queries": []}
            hourly_groups[hr]["durations"].append(sample["duration_ms"])
            hourly_groups[hr]["queries"].append(sample["db_query_count"])

        hourly_trends = []
        for hr, data in sorted(hourly_groups.items()):
            durations = sorted(data["durations"])
            count = len(durations)
            hourly_trends.append(
                {
                    "hour": hr.isoformat(),
                    "count": count,
                    "p50": durations[int(count * 0.5)] if count else 0,
                    "p95": durations[int(count * 0.95)] if count else 0,
                    "p99": durations[int(count * 0.99)] if count else 0,
                    "avg_duration": sum(durations) / count if count else 0,
                    "avg_queries": sum(data["queries"]) / count if count else 0,
                }
            )

        # Top 10 slowest endpoints (by average duration)
        top_slowest = (
            qs.values("view_name", "method")
            .annotate(
                avg_duration=Avg("duration_ms"),
                max_duration=Max("duration_ms"),
                avg_queries=Avg("db_query_count"),
                count=Count("id"),
            )
            .order_by("-avg_duration")[:20]
        )

        return Response(
            {"hourly_trends": hourly_trends, "top_slowest_endpoints": list(top_slowest)}
        )


class I18nDetectView(APIView):
    permission_classes = []

    def get(self, request):
        accept_lang = request.headers.get("Accept-Language", "")
        langs = [lang.split(";")[0].strip() for lang in accept_lang.split(",") if lang]
        locale = "en"
        supported = ["en", "fr", "es", "hi", "pt-BR", "zh-CN", "ar", "de", "ja"]
        
        for lang in langs:
            if lang in supported:
                locale = lang
                break
            prefix = lang.split("-")[0]
            if prefix in supported:
                locale = prefix
                break
        
        fallback_chain = [locale]
        if locale != "en":
            prefix = locale.split("-")[0]
            if prefix != locale and prefix not in fallback_chain:
                fallback_chain.append(prefix)
            fallback_chain.append("en")
            
        return Response({
            "locale": locale,
            "fallback_chain": fallback_chain
        })
