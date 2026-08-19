import pytest
from unittest.mock import MagicMock, patch
from django.test import RequestFactory
from django.http import HttpResponse
from apps.core.middleware.otel import OpenTelemetryMiddleware


class TestOpenTelemetryTracing:
    def test_otel_middleware_disabled_by_default(self, settings):
        settings.OTEL_ENABLED = False
        factory = RequestFactory()
        request = factory.get("/api/health/")

        get_response = MagicMock(return_value=HttpResponse("OK", status=200))
        middleware = OpenTelemetryMiddleware(get_response)

        response = middleware(request)
        assert response.status_code == 200
        get_response.assert_called_once_with(request)

    def test_otel_middleware_enabled_with_debug_trace_header(self, settings):
        settings.OTEL_ENABLED = True
        settings.OTEL_SAMPLE_RATE = 0.0  # 0% standard sampling
        factory = RequestFactory()
        request = factory.get("/api/health/", HTTP_X_DEBUG_TRACE="1")

        get_response = MagicMock(return_value=HttpResponse("OK", status=200))
        middleware = OpenTelemetryMiddleware(get_response)

        response = middleware(request)
        assert response.status_code == 200
        assert "traceparent" in response
        assert response["traceparent"].startswith("00-")
        assert response["traceparent"].endswith("-01")

    def test_otel_config_helper(self, settings):
        from config.opentelemetry import is_otel_enabled

        settings.OTEL_ENABLED = True
        assert is_otel_enabled() is True

        settings.OTEL_ENABLED = False
        assert is_otel_enabled() is False
