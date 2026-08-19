"""
OpenTelemetry Middleware for Django & Trace Context Sampling.

Supports:
- Dynamic trace sampling (10% default, 100% on X-Debug-Trace: 1)
- Context propagation across HTTP and Celery
- Attaching trace context and spans to requests
"""

from __future__ import annotations

import logging
import random
import time
import uuid
from typing import Any
from django.conf import settings

logger = logging.getLogger(__name__)

_OTEL_AVAILABLE = False
_trace: Any = None

try:
    from opentelemetry import context as otel_context
    from opentelemetry import trace as _otel_trace
    from opentelemetry.trace import (
        NonRecordingSpan,
        SpanContext,
        SpanKind,
        Status,
        StatusCode,
        TraceFlags,
        set_span_in_context,
    )

    _trace = _otel_trace
    _OTEL_AVAILABLE = True
except ImportError:
    otel_context = None
    NonRecordingSpan = None
    SpanContext = None
    Status = None
    StatusCode = None
    SpanKind = None
    TraceFlags = None
    set_span_in_context = None


class OpenTelemetryMiddleware:
    """
    Middleware for tracing HTTP requests and propagating W3C trace context.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        otel_enabled = getattr(settings, "OTEL_ENABLED", False)
        if not otel_enabled or not _OTEL_AVAILABLE:
            return self.get_response(request)

        # Sampling logic: 100% if X-Debug-Trace: 1 or debug header present, else sample_rate (default 10%)
        sample_rate = getattr(settings, "OTEL_SAMPLE_RATE", 0.1)
        debug_trace = request.headers.get("X-Debug-Trace", "").strip() == "1" or \
                      request.META.get("HTTP_X_DEBUG_TRACE", "").strip() == "1"

        is_sampled = debug_trace or (random.random() < sample_rate)
        trace_flags = "01" if is_sampled else "00"

        traceparent = request.headers.get("traceparent") or request.META.get("HTTP_TRACEPARENT")
        if traceparent:
            parts = traceparent.strip().split("-")
            if len(parts) == 4:
                trace_id, parent_span_id = parts[1], parts[2]
            else:
                trace_id = uuid.uuid4().hex
                parent_span_id = uuid.uuid4().hex[:16]
        else:
            trace_id = uuid.uuid4().hex
            parent_span_id = uuid.uuid4().hex[:16]

        current_span_id = uuid.uuid4().hex[:16]
        span_name = f"{request.method} {request.path}"
        span = None
        token = None

        if _OTEL_AVAILABLE and is_sampled:
            try:
                tracer = _trace.get_tracer("apps.core.middleware.otel")
                remote_ctx = SpanContext(
                    trace_id=int(trace_id, 16),
                    span_id=int(parent_span_id, 16),
                    is_remote=True,
                    trace_flags=TraceFlags(0x01 if is_sampled else 0x00),
                )
                parent_ctx = set_span_in_context(NonRecordingSpan(remote_ctx))
                token = otel_context.attach(parent_ctx)
                span = tracer.start_span(span_name, kind=SpanKind.SERVER)
                span.set_attribute("http.method", request.method)
                span.set_attribute("http.route", request.path)
                span.set_attribute("http.debug_trace", debug_trace)
            except Exception as e:
                logger.debug("Failed to create otel span: %s", e)

        request.trace_id = trace_id
        request.otel_span = span

        response = None
        status_code = 500
        try:
            response = self.get_response(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            if span and Status is not None:
                span.set_status(Status(StatusCode.ERROR, str(exc)))
            raise
        finally:
            if span:
                span.set_attribute("http.status_code", status_code)
                if status_code >= 500 and Status is not None:
                    span.set_status(Status(StatusCode.ERROR))
                span.end()
            if token and otel_context:
                otel_context.detach(token)

            if response is not None:
                response["traceparent"] = f"00-{trace_id}-{current_span_id}-{trace_flags}"
