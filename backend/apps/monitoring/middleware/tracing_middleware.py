"""
Django middleware for W3C Trace Context propagation and request span recording.

Reads ``traceparent`` / ``tracestate`` from incoming headers, creates or continues
a span context (OpenTelemetry when available, UUID-based fallback otherwise),
sets ``traceparent`` on the response, and records HTTP metrics.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from apps.monitoring.exporters.prometheus_exporter import record_http_request

logger = logging.getLogger(__name__)

# W3C traceparent: version-trace_id-parent_id-trace_flags
_TRACEPARENT_RE = re.compile(
    r"^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$",
    re.IGNORECASE,
)

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
    otel_context = None  # type: ignore[assignment]
    NonRecordingSpan = None  # type: ignore[misc, assignment]
    SpanContext = None  # type: ignore[misc, assignment]
    Status = None  # type: ignore[misc, assignment]
    StatusCode = None  # type: ignore[misc, assignment]
    SpanKind = None  # type: ignore[misc, assignment]
    TraceFlags = None  # type: ignore[misc, assignment]
    set_span_in_context = None  # type: ignore[misc, assignment]


@dataclass
class FallbackSpan:
    """Lightweight span stand-in when OpenTelemetry SDK is not installed."""

    trace_id: str
    span_id: str
    name: str
    attributes: dict[str, Any] = field(default_factory=dict)
    _start: float = field(default_factory=time.time)

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_status(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    def end(self) -> None:
        duration_ms = (time.time() - self._start) * 1000
        logger.debug(
            "fallback span ended",
            extra={
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "name": self.name,
                "duration_ms": round(duration_ms, 2),
                **self.attributes,
            },
        )


def _parse_traceparent(header: str | None) -> tuple[str, str, str]:
    """
    Parse W3C traceparent header.

    Returns (trace_id, parent_span_id, flags) — all lowercase hex strings.
    Generates new IDs when the header is missing or malformed.
    """
    if header:
        match = _TRACEPARENT_RE.match(header.strip())
        if match:
            return match.group(1).lower(), match.group(2).lower(), match.group(3).lower()

    trace_id = uuid.uuid4().hex
    span_id = uuid.uuid4().hex[:16]
    return trace_id, span_id, "01"


def _format_traceparent(trace_id: str, span_id: str, flags: str = "01") -> str:
    return f"00-{trace_id}-{span_id}-{flags}"


def _start_otel_span(
    trace_id: str, parent_span_id: str, name: str, method: str, path: str
) -> tuple[Any, Any]:
    """Start an OpenTelemetry server span linked to the incoming trace context."""
    tracer = _trace.get_tracer(__name__)
    remote_ctx = SpanContext(
        trace_id=int(trace_id, 16),
        span_id=int(parent_span_id, 16),
        is_remote=True,
        trace_flags=TraceFlags(0x01),
    )
    parent_ctx = set_span_in_context(NonRecordingSpan(remote_ctx))
    token = otel_context.attach(parent_ctx)
    span = tracer.start_span(name, kind=SpanKind.SERVER)
    span.set_attribute("http.method", method)
    span.set_attribute("http.route", path)
    return span, token


class TracingMiddleware:
    """
    Propagate W3C trace context through Django requests and record HTTP metrics.

    Attaches ``request.otel_span`` and ``request.trace_id`` for downstream use.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        tracestate = request.headers.get("tracestate", "")
        trace_id, parent_span_id, flags = _parse_traceparent(
            request.headers.get("traceparent")
        )

        span_name = f"{request.method} {request.path}"
        span: Any
        otel_token: Any = None
        current_span_id = uuid.uuid4().hex[:16]

        if _OTEL_AVAILABLE:
            span, otel_token = _start_otel_span(
                trace_id, parent_span_id, span_name, request.method, request.path
            )
            otel_span_ctx = span.get_span_context()
            if otel_span_ctx and otel_span_ctx.is_valid:
                trace_id = format(otel_span_ctx.trace_id, "032x")
                current_span_id = format(otel_span_ctx.span_id, "016x")
        else:
            span = FallbackSpan(
                trace_id=trace_id,
                span_id=current_span_id,
                name=span_name,
            )
            span.set_attribute("http.method", request.method)
            span.set_attribute("http.route", request.path)

        request.otel_span = span
        request.trace_id = trace_id

        response = None
        status_code = 500
        try:
            response = self.get_response(request)
            status_code = response.status_code
            return response
        except Exception:
            if _OTEL_AVAILABLE and Status is not None:
                span.set_status(Status(StatusCode.ERROR))
            elif hasattr(span, "set_status"):
                span.set_status("error")
            raise
        finally:
            duration = time.monotonic() - start

            if _OTEL_AVAILABLE:
                span.set_attribute("http.status_code", status_code)
                if status_code >= 500 and Status is not None:
                    span.set_status(Status(StatusCode.ERROR))
            else:
                span.set_attribute("http.status_code", status_code)

            span.end()
            if otel_token is not None:
                otel_context.detach(otel_token)

            record_http_request(
                method=request.method,
                path=request.path,
                status=status_code,
                duration_seconds=duration,
            )

            traceparent = _format_traceparent(trace_id, current_span_id, flags)
            if response is not None:
                response["traceparent"] = traceparent
                if tracestate:
                    response["tracestate"] = tracestate
