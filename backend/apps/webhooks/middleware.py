import hashlib
import hmac
import logging
import time
from typing import Optional

from django.conf import settings
from django.http import HttpRequest, JsonResponse

logger = logging.getLogger(__name__)


class WebhookSignatureMiddleware:
    """
    Middleware that enforces HMAC-SHA256 signature verification and timestamp replay protection
    for incoming webhook routes.

    Key rotation is supported via settings.WEBHOOK_SIGNING_KEYS, a list of (key_id, secret) pairs.
    Verification attempts each key in order. Replay protection rejects requests older than
    settings.WEBHOOK_TIMESTAMP_WINDOW_SECONDS (default: 300s).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest):
        if self._is_webhook_request(request):
            error_response = self._verify_webhook(request)
            if error_response:
                return error_response
        return self.get_response(request)

    def _is_webhook_request(self, request: HttpRequest) -> bool:
        path = request.path
        # Exclude management CRUD routes unless explicitly carrying signature headers
        management_routes = ["/api/webhooks/endpoints/", "/api/webhooks/deliveries/"]
        if any(path.startswith(route) for route in management_routes):
            if "HTTP_X_WEBHOOK_SIGNATURE" not in request.META and "HTTP_X_SIGNATURE" not in request.META:
                return False

        prefixes = getattr(
            settings,
            "WEBHOOK_INCOMING_URL_PREFIXES",
            [
                "/api/webhooks/incoming",
                "/api/webhooks/receiver",
                "/api/notifications/webhook",
                "/webhook/",
            ],
        )
        if any(path.startswith(prefix) for prefix in prefixes):
            return True
        if "HTTP_X_WEBHOOK_SIGNATURE" in request.META or "HTTP_X_SIGNATURE" in request.META:
            return True
        return False

    def _verify_webhook(self, request: HttpRequest) -> Optional[JsonResponse]:
        signature = request.META.get("HTTP_X_WEBHOOK_SIGNATURE") or request.META.get("HTTP_X_SIGNATURE")
        if not signature:
            return JsonResponse({"error": "Missing X-Webhook-Signature header"}, status=401)

        timestamp_str = request.META.get("HTTP_X_WEBHOOK_TIMESTAMP") or request.META.get("HTTP_X_TIMESTAMP")
        if not timestamp_str:
            return JsonResponse({"error": "Missing X-Webhook-Timestamp header"}, status=400)

        try:
            timestamp_val = float(timestamp_str)
        except (ValueError, TypeError):
            return JsonResponse({"error": "Invalid X-Webhook-Timestamp header format"}, status=400)

        window = getattr(settings, "WEBHOOK_TIMESTAMP_WINDOW_SECONDS", 300)
        current_time = time.time()
        if abs(current_time - timestamp_val) > window:
            logger.warning(
                "Webhook replay attack detected or timestamp expired. Delta: %f s",
                abs(current_time - timestamp_val),
            )
            return JsonResponse({"error": "Webhook timestamp expired / out of window"}, status=400)

        payload = request.body
        clean_sig = signature.removeprefix("sha256=") if signature.startswith("sha256=") else signature

        keys = getattr(settings, "WEBHOOK_SIGNING_KEYS", [("default_v1", "default-webhook-secret-key-change-in-production")])

        verified_key_id = None
        for key_id, secret in keys:
            if not secret:
                continue
            secret_bytes = secret.encode("utf-8")
            expected_sig = hmac.new(secret_bytes, payload, hashlib.sha256).hexdigest()
            expected_sig_ts = hmac.new(secret_bytes, f"{timestamp_str}.".encode("utf-8") + payload, hashlib.sha256).hexdigest()

            if hmac.compare_digest(expected_sig, clean_sig) or hmac.compare_digest(expected_sig_ts, clean_sig):
                verified_key_id = key_id
                break

        if verified_key_id is not None:
            request.webhook_key_id = verified_key_id
            return None

        logger.warning("Invalid webhook signature for request path %s", request.path)
        return JsonResponse({"error": "Invalid webhook signature"}, status=403)
