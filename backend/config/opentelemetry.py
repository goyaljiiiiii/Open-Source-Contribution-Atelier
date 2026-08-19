"""
OpenTelemetry Tracing Configuration.

Configures TracerProvider, OTLP Exporter, BatchSpanProcessor, and custom Samplers
for Django, Celery, and Channels.
"""

import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

_INITIALIZED = False


def is_otel_enabled() -> bool:
    """Check whether OpenTelemetry tracing is enabled via settings or env."""
    enabled_setting = getattr(settings, "OTEL_ENABLED", None)
    if enabled_setting is not None:
        return bool(enabled_setting)
    return os.getenv("ENABLE_OPENTELEMETRY", "False").lower() in ("true", "1", "yes") or \
           os.getenv("OTEL_ENABLED", "False").lower() in ("true", "1", "yes")


def setup_opentelemetry():
    """
    Initialize OpenTelemetry SDK, tracer provider, batch span processor,
    and automatic instrumentation for Django and Celery.
    """
    global _INITIALIZED
    if _INITIALIZED:
        return

    if not is_otel_enabled():
        logger.debug("OpenTelemetry tracing is disabled (OTEL_ENABLED is false).")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.trace.sampling import (
            DEFAULT_OFF,
            DEFAULT_ON,
            ParentBased,
            Sampler,
            SamplingResult,
            Decision,
        )
    except ImportError:
        logger.warning("OpenTelemetry packages not installed. Skipping tracing setup.")
        return

    service_name = getattr(settings, "OTEL_SERVICE_NAME", os.getenv("OTEL_SERVICE_NAME", "contribution-atelier-backend"))
    resource = Resource.create(attributes={SERVICE_NAME: service_name})

    endpoint = getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces"))
    otlp_exporter = OTLPSpanExporter(endpoint=endpoint)

    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(otlp_exporter)
    provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)

    # Instrument Django
    try:
        DjangoInstrumentor().instrument()
    except Exception as e:
        logger.warning("Failed to instrument Django with OpenTelemetry: %s", e)

    # Instrument Celery if available
    try:
        from opentelemetry.instrumentation.celery import CeleryInstrumentor
        CeleryInstrumentor().instrument()
    except Exception:
        pass

    _INITIALIZED = True
    logger.info("OpenTelemetry tracing initialized successfully for %s", service_name)
