from django.db import migrations, models


class SafeAddConstraint(migrations.AddConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = from_state.apps.get_model(app_label, self.model_name)
        table_name = model._meta.db_table
        with schema_editor.connection.cursor() as cursor:
            existing_constraints = schema_editor.connection.introspection.get_constraints(
                cursor, table_name
            )
        if self.constraint.name in existing_constraints:
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


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
