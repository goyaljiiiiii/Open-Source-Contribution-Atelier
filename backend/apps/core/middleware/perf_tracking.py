import random
import time

from django.conf import settings
from django.db import connection

from apps.core.models import PerformanceSample


class PerformanceTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.sample_rate = getattr(settings, "PERF_TRACK_SAMPLE_RATE", 0.1)

    def __call__(self, request):
        if random.random() >= self.sample_rate:
            return self.get_response(request)

        query_count = [0]
        db_duration = [0.0]

        def query_wrapper(execute, sql, params, many, context):
            start_db = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                duration = (time.perf_counter() - start_db) * 1000
                query_count[0] += 1
                db_duration[0] += duration

        start_time = time.perf_counter()

        with connection.execute_wrapper(query_wrapper):
            response = self.get_response(request)

        if not hasattr(response, "status_code"):
            return response

        view_name = (
            request.resolver_match.view_name if request.resolver_match else request.path
        )
        if not view_name:
            view_name = "unknown"

        total_duration = (time.perf_counter() - start_time) * 1000

        user_id = None
        if hasattr(request, "user") and request.user.is_authenticated:
            user_id = request.user.id

        try:
            PerformanceSample.objects.create(
                view_name=view_name,
                method=request.method,
                duration_ms=total_duration,
                db_query_count=query_count[0],
                db_duration_ms=db_duration[0],
                cache_hits=0,
                cache_misses=0,
                serialization_ms=0,
                user_id=user_id,
            )
        except Exception:
            pass

        return response
