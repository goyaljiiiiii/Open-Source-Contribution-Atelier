# Generated manually for issue_quality models including ScanReport (#2402)

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="IssueQualityCheck",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("issue_title", models.TextField()),
                ("issue_body", models.TextField()),
                ("author", models.CharField(max_length=255)),
                ("quality_score", models.FloatField(default=0.0)),
                ("clarity_score", models.FloatField(default=0.0)),
                ("completeness_score", models.FloatField(default=0.0)),
                ("reproducibility_score", models.FloatField(default=0.0)),
                ("is_duplicate", models.BooleanField(default=False)),
                ("duplicate_confidence", models.FloatField(default=0.0)),
                ("duplicate_of", models.CharField(blank=True, max_length=255)),
                ("language", models.CharField(default="en", max_length=50)),
                ("is_english", models.BooleanField(default=True)),
                ("translation_suggestion", models.TextField(blank=True)),
                ("is_user_specific", models.BooleanField(default=False)),
                ("environment_warning", models.TextField(blank=True)),
                ("predicted_comments", models.IntegerField(default=0)),
                ("predicted_engagement_score", models.FloatField(default=0.0)),
                ("wontfix_risk_score", models.FloatField(default=0.0)),
                ("wontfix_reasons", models.JSONField(default=list)),
                ("recommendations", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="DuplicateIssue",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("issue_id", models.CharField(max_length=100, unique=True)),
                ("title", models.TextField()),
                ("body", models.TextField()),
                ("embedding", models.JSONField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="WontfixPattern",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("pattern", models.CharField(max_length=500)),
                ("category", models.CharField(max_length=50)),
                ("frequency", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-frequency"]},
        ),
        migrations.CreateModel(
            name="ScanReport",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("files", models.JSONField(default=list)),
                ("report", models.JSONField(default=dict)),
                ("risk_score", models.FloatField(default=0.0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
