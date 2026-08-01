import hashlib
import json
import logging
from datetime import timedelta
from functools import wraps

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.response import Response

from .models import IdempotencyRecord

logger = logging.getLogger(__name__)

IDEMPOTENCY_HEADER = "Idempotency-Key"
IDEMPOTENCY_TTL_HOURS = 24


def idempotent(view_func):
    @wraps(view_func)
    def wrapper(view_instance, request, *args, **kwargs):
        idempotency_key = request.META.get(f"HTTP_{IDEMPOTENCY_HEADER.upper().replace('-', '_')}") or request.headers.get(IDEMPOTENCY_HEADER)

        if not idempotency_key:
            return view_func(view_instance, request, *args, **kwargs)

        endpoint = request.path
        method = request.method
        body_hash = IdempotencyRecord.hash_request_body(request.body)

        existing = IdempotencyRecord.objects.filter(
            idempotency_key=idempotency_key,
            endpoint=endpoint,
        ).first()

        if existing is not None:
            if existing.request_body_hash != body_hash:
                return Response(
                    {
                        "error": "Idempotency key already exists with a different request body",
                        "idempotency_key": idempotency_key,
                    },
                    status=409,
                )

            if existing.expires_at < timezone.now():
                existing.delete()
            else:
                try:
                    response_data = json.loads(existing.response_body)
                except (json.JSONDecodeError, TypeError):
                    response_data = existing.response_body

                return Response(
                    response_data,
                    status=existing.response_status,
                    headers={"Idempotency-Replay": "true"},
                )

        response = view_func(view_instance, request, *args, **kwargs)

        if isinstance(response, Response):
            response_status = response.status_code
            try:
                response_body = json.dumps(response.data) if response.data is not None else ""
            except (TypeError, ValueError):
                response_body = str(response.data) if response.data is not None else ""

            if 200 <= response_status < 500:
                try:
                    IdempotencyRecord.objects.create(
                        idempotency_key=idempotency_key,
                        user=request.user if request.user.is_authenticated else None,
                        endpoint=endpoint,
                        request_body_hash=body_hash,
                        request_method=method,
                        response_status=response_status,
                        response_body=response_body,
                        expires_at=timezone.now() + timedelta(hours=IDEMPOTENCY_TTL_HOURS),
                    )
                except Exception as e:
                    logger.warning(f"Failed to store idempotency record: {e}")

        return response

    return wrapper
