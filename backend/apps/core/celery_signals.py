from celery.signals import before_task_publish, task_postrun, task_prerun

from apps.core.middleware.request_id import _thread_locals, get_request_id


@before_task_publish.connect
def add_request_id_to_task(headers=None, **kwargs):
    req_id = get_request_id()
    if req_id and headers is not None:
        headers["x-request-id"] = req_id

    # Propagate trace context if OpenTelemetry is enabled
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span and span.get_span_context().is_valid and headers is not None:
            ctx = span.get_span_context()
            trace_id = format(ctx.trace_id, "032x")
            span_id = format(ctx.span_id, "016x")
            headers["traceparent"] = f"00-{trace_id}-{span_id}-01"
    except Exception:
        pass


@task_prerun.connect
def set_request_id_in_task(task_id, task, *args, **kwargs):
    # task.request holds the headers passed to the task
    req_id = getattr(task.request, "x-request-id", None)
    if not req_id and hasattr(task.request, "headers") and task.request.headers:
        req_id = task.request.headers.get("x-request-id")

    if req_id:
        _thread_locals.request_id = req_id
    else:
        # If no request_id, generate one for the background task
        import uuid

        _thread_locals.request_id = f"celery-{uuid.uuid4()}"


@task_postrun.connect
def cleanup_request_id_in_task(task_id, task, *args, **kwargs):
    if hasattr(_thread_locals, "request_id"):
        _thread_locals.request_id = None

