import base64
import hashlib
import hmac
import re
from datetime import datetime

from django.conf import settings
from django.db import connection
from django.db.models import Q
from rest_framework import pagination
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


class SecureCursorPagination(pagination.BasePagination):
    """
    A cursor-based pagination that uses a composite key (created_at, id)
    for deterministic sorting, avoiding collisions on concurrent inserts.

    The cursor payload is signed with HMAC-SHA256 to prevent tampering.
    """

    cursor_query_param = "cursor"
    page_size = 25
    invalid_cursor_message = "Invalid cursor signature. Please re-request from page 1."

    def paginate_queryset(self, queryset, request, view=None):
        self.request = request
        self.page_size = self.get_page_size(request) or self.page_size

        # Parse cursor
        cursor = request.query_params.get(self.cursor_query_param)
        cursor_created_at = None
        cursor_id = None

        if cursor:
            try:
                # Expecting format: base64(payload).signature
                parts = cursor.split(".")
                if len(parts) != 2:
                    # Old cursor or tampered cursor
                    raise ValidationError(self.invalid_cursor_message)

                b64_payload, signature = parts

                # Verify signature
                expected_sig = hmac.new(
                    settings.SECRET_KEY.encode("utf-8"),
                    b64_payload.encode("ascii"),
                    hashlib.sha256,
                ).hexdigest()[:12]

                if not hmac.compare_digest(signature, expected_sig):
                    raise ValidationError(self.invalid_cursor_message)

                # Decode payload: f"{created_at.timestamp()}|{id}"
                # Add padding back if necessary
                padding = b"=" * (-len(b64_payload) % 4)
                payload = base64.urlsafe_b64decode(
                    b64_payload.encode("ascii") + padding
                ).decode("utf-8")

                ts_str, id_str = payload.split("|")
                cursor_created_at = datetime.fromtimestamp(float(ts_str))
                cursor_id = int(id_str)
            except (ValueError, TypeError, base64.binascii.Error):
                raise ValidationError(self.invalid_cursor_message)

        # Apply ordering
        queryset = queryset.order_by("-created_at", "-id")

        if cursor_created_at is not None and cursor_id is not None:
            # We want created_at < cursor_created_at OR (created_at == cursor_created_at AND id < cursor_id)
            queryset = queryset.filter(
                Q(created_at__lt=cursor_created_at)
                | Q(created_at=cursor_created_at, id__lt=cursor_id)
            )

        # We fetch one extra item to check if there is a next page
        results = list(queryset[: self.page_size + 1])

        self.has_next = len(results) > self.page_size
        self.page = results[: self.page_size]

        # Calculate totals and remaining
        total = self.get_total_estimate(queryset.model.objects.all())
        # To get remaining correctly, it should be the remaining items AFTER this page.
        # But for estimate, we can just compute it based on the remaining in the filtered queryset
        remaining_in_query = self.get_total_estimate(queryset)
        self.remaining = max(0, remaining_in_query - len(self.page))
        self.total_estimate = total

        return self.page

    def get_total_estimate(self, queryset):
        """
        Returns a fast estimate of the total rows for the query.
        Uses PostgreSQL EXPLAIN if possible, otherwise falls back to count().
        """
        if connection.vendor == "postgresql":
            try:
                query, params = queryset.query.sql_with_params()
                with connection.cursor() as cursor:
                    cursor.execute(f"EXPLAIN {query}", params)
                    explain_result = cursor.fetchall()
                    for row in explain_result:
                        match = re.search(r"rows=(\d+)", row[0])
                        if match:
                            return int(match.group(1))
            except Exception:
                pass

        try:
            return queryset.count()
        except Exception:
            return len(queryset)

    def get_page_size(self, request):
        if hasattr(self, "page_size_query_param") and getattr(
            self, "page_size_query_param", None
        ):
            try:
                return int(request.query_params[self.page_size_query_param])
            except (KeyError, ValueError, TypeError):
                pass
        return self.page_size

    def encode_cursor(self, item):
        """
        Creates a base64 encoded cursor with HMAC signature.
        """
        if not item:
            return None

        # Format payload as timestamp|id
        ts = item.created_at.timestamp()
        payload = f"{ts}|{item.id}"

        b64_payload = (
            base64.urlsafe_b64encode(payload.encode("utf-8"))
            .decode("ascii")
            .rstrip("=")
        )

        signature = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            b64_payload.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()[:12]

        return f"{b64_payload}.{signature}"

    def get_next_link(self):
        if not self.has_next or not self.page:
            return None

        last_item = self.page[-1]
        cursor_val = self.encode_cursor(last_item)

        url = self.request.build_absolute_uri()
        return pagination.replace_query_param(url, self.cursor_query_param, cursor_val)

    def get_paginated_response(self, data):
        return Response(
            {
                "next": self.get_next_link(),
                "remaining": self.remaining,
                "total_estimate": self.total_estimate,
                "results": data,
            }
        )
