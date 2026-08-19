from django.db import migrations, models


class SafeAddConstraint(migrations.AddConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
        except Exception as e:
            if "already exists" in str(e).lower():
                pass
            else:
                raise


class Migration(migrations.Migration):

    dependencies = [
        ("progress", "0033_leaderboard_mv"),
    ]

    operations = [
        migrations.AlterField(
            model_name="lessonprogress",
            name="attempt_count",
            field=models.PositiveIntegerField(default=0),
        ),
        SafeAddConstraint(
            model_name="lessonprogress",
            constraint=models.CheckConstraint(
                check=models.Q(attempt_count__gte=0),
                name="progress_lessonprogress_attempt_count_gte_0",
            ),
        ),
    ]
