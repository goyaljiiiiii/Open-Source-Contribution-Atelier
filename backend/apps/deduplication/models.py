import hashlib
import json
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class IdempotencyRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idempotency_key = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="idempotency_records",
    )
    endpoint = models.CharField(max_length=512)
    request_body_hash = models.CharField(max_length=64)
    request_method = models.CharField(max_length=10)
    response_status = models.PositiveIntegerField()
    response_body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["idempotency_key", "endpoint"],
                name="unique_idempotency_key_endpoint",
            ),
        ]
        indexes = [
            models.Index(fields=["idempotency_key"], name="idx_idempotency_key"),
            models.Index(fields=["expires_at"], name="idx_idempotency_expires"),
        ]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @staticmethod
    def hash_request_body(body: bytes) -> str:
        return hashlib.sha256(body).hexdigest()

    def __str__(self):
        return f"IdempotencyRecord(key={self.idempotency_key}, endpoint={self.endpoint})"
