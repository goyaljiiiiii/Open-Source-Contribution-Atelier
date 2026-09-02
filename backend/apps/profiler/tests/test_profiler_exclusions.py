import time

import pytest
from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory

from apps.profiler.middleware import SlowEndpointProfiler


@pytest.fixture(autouse=True)
def clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def profiler_middleware():
    def get_response(req):
        return HttpResponse("OK")

    middleware = SlowEndpointProfiler(get_response)
    middleware.slow_threshold = 0.01  # 10ms threshold to test slow profiling
    return middleware


@pytest.mark.parametrize(
    "path",
    [
        "/static/css/main.css",
        "/static/js/bundle.js",
        "/media/avatars/user_1.png",
        "/media/uploads/doc.pdf",
        "/favicon.ico",
        "/robots.txt",
        "/assets/font.woff2",
        "/images/banner.webp",
    ],
)
def test_is_static_or_media_path_true(profiler_middleware, path):
    assert profiler_middleware.is_static_or_media_path(path) is True


@pytest.mark.parametrize(
    "path",
    [
        "/api/lessons/",
        "/api/progress/me/",
        "/api/burnout-detection/user-trends/",
        "/api/auth/login/",
        "/dashboard/",
    ],
)
def test_is_static_or_media_path_false(profiler_middleware, path):
    assert profiler_middleware.is_static_or_media_path(path) is False


def test_static_request_is_not_profiled(profiler_middleware):
    rf = RequestFactory()
    request = rf.get("/static/app.js")

    profiler_middleware.process_request(request)
    assert not hasattr(request, "_profile_data")

    # Simulate slow response
    time.sleep(0.02)
    response = HttpResponse("console.log('static');")
    resp = profiler_middleware.process_response(request, response)

    assert "X-Profile-Time" not in resp
    assert cache.get("slow_endpoint_profiles") is None


def test_slow_api_request_is_profiled_and_cached(profiler_middleware):
    rf = RequestFactory()
    request = rf.get("/api/lessons/slow-endpoint/")

    profiler_middleware.process_request(request)
    assert hasattr(request, "_profile_data")

    # Simulate slow response exceeding threshold
    time.sleep(0.02)
    response = HttpResponse('{"data": "slow response"}')
    resp = profiler_middleware.process_response(request, response)

    assert "X-Profile-Time" in resp
    profiles = cache.get("slow_endpoint_profiles")
    assert profiles is not None
    assert len(profiles) == 1
    assert profiles[0]["path"] == "/api/lessons/slow-endpoint/"
