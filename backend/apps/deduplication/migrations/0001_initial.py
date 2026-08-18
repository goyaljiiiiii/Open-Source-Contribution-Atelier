from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="IdempotencyRecord",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        primary_key=True,
                        default=uuid.uuid4,
                        editable=False,
                    ),
                ),
                ("idempotency_key", models.CharField(max_length=255, db_index=True)),
                (
                    "user",
                    models.ForeignKey(
                        null=True,
                        blank=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="idempotency_records",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("endpoint", models.CharField(max_length=512)),
                ("request_body_hash", models.CharField(max_length=64)),
                ("request_method", models.CharField(max_length=10)),
                ("response_status", models.PositiveIntegerField()),
                ("response_body", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["idempotency_key"],
                        name="idx_idempotency_key",
                    ),
                    models.Index(
                        fields=["expires_at"],
                        name="idx_idempotency_expires",
                    ),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="idempotencyrecord",
            constraint=models.UniqueConstraint(
                fields=["idempotency_key", "endpoint"],
                name="unique_idempotency_key_endpoint",
            ),
        ),
    ]
