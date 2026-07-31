/**
 * OpenTelemetry Web tracer provider helpers and W3C trace header generation.
 *
 * Works with or without a fully initialized OTLP exporter — when tracing is
 * disabled, lightweight UUID-based traceparent headers are still produced so
 * backend correlation remains possible.
 */

import { trace, context, SpanContext, TraceFlags } from "@opentelemetry/api";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";

let providerInstance: WebTracerProvider | null = null;

/** Return the active WebTracerProvider, creating a minimal one if needed. */
export function getWebTracerProvider(): WebTracerProvider {
  if (providerInstance) {
    return providerInstance;
  }

  const existing = trace.getTracerProvider();
  if (existing && "register" in existing) {
    providerInstance = existing as WebTracerProvider;
    return providerInstance;
  }

  providerInstance = new WebTracerProvider();
  providerInstance.register();
  return providerInstance;
}

/** Set the provider instance after full OTLP initialization in tracing.ts. */
export function setWebTracerProvider(provider: WebTracerProvider): void {
  providerInstance = provider;
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function formatTraceparent(traceId: string, spanId: string, sampled = true): string {
  const flags = sampled ? "01" : "00";
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Build W3C ``traceparent`` / ``tracestate`` headers for outbound requests.
 *
 * Uses the active OpenTelemetry span when available; otherwise generates
 * ephemeral trace identifiers.
 */
export function getTraceHeaders(): Record<string, string> {
  const activeSpan = trace.getSpan(context.active());
  const spanContext: SpanContext | undefined = activeSpan?.spanContext();

  if (spanContext && spanContext.traceId && spanContext.spanId) {
    const sampled = (spanContext.traceFlags & TraceFlags.SAMPLED) !== 0;
    return {
      traceparent: formatTraceparent(
        spanContext.traceId,
        spanContext.spanId,
        sampled,
      ),
      tracestate: "",
    };
  }

  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    traceparent: formatTraceparent(traceId, spanId),
    tracestate: "",
  };
}

export interface NavigationTimingMetrics {
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  dnsMs: number | null;
  tcpMs: number | null;
  transferMs: number | null;
}

function readNavigationTiming(): NavigationTimingMetrics | null {
  if (typeof performance === "undefined") {
    return null;
  }

  const entries = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  const nav = entries[0];
  if (!nav) {
    return null;
  }

  return {
    ttfbMs: nav.responseStart > 0 ? nav.responseStart - nav.requestStart : null,
    domContentLoadedMs:
      nav.domContentLoadedEventEnd > 0
        ? nav.domContentLoadedEventEnd - nav.startTime
        : null,
    loadEventMs:
      nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : null,
    dnsMs: nav.domainLookupEnd - nav.domainLookupStart,
    tcpMs: nav.connectEnd - nav.connectStart,
    transferMs: nav.responseEnd - nav.responseStart,
  };
}

/**
 * Record Real User Monitoring (RUM) navigation timing metrics.
 *
 * Creates an OpenTelemetry span when tracing is active; always logs a
 * structured console message for local debugging.
 */
export function logNavigationTiming(): void {
  const metrics = readNavigationTiming();
  if (!metrics) {
    return;
  }

  const tracer = trace.getTracer("rum.navigation");
  const span = tracer.startSpan("page.navigation_timing");
  span.setAttribute("rum.ttfb_ms", metrics.ttfbMs ?? -1);
  span.setAttribute("rum.dom_content_loaded_ms", metrics.domContentLoadedMs ?? -1);
  span.setAttribute("rum.load_event_ms", metrics.loadEventMs ?? -1);
  span.setAttribute("rum.dns_ms", metrics.dnsMs ?? -1);
  span.setAttribute("rum.tcp_ms", metrics.tcpMs ?? -1);
  span.setAttribute("rum.transfer_ms", metrics.transferMs ?? -1);
  span.end();

  console.debug("[RUM] Navigation timing", metrics);
}
