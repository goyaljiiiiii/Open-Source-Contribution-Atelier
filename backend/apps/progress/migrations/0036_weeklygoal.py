from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("progress", "0035_merge_leaves"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WeeklyGoal",
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
                ("week_start_date", models.DateField(db_index=True)),
                ("target_lessons", models.PositiveIntegerField(default=5)),
                ("target_xp", models.PositiveIntegerField(default=500)),
                ("target_minutes", models.PositiveIntegerField(default=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="weekly_goals",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-week_start_date"],
            },
        ),
        migrations.AddConstraint(
            model_name="weeklygoal",
            constraint=models.UniqueConstraint(
                fields=("user", "week_start_date"), name="unique_user_weekly_goal"
            ),
        ),
    ]
