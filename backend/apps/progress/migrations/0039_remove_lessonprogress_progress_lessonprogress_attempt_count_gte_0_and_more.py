from django.db import migrations, models


class SafeRemoveConstraint(migrations.RemoveConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = from_state.apps.get_model(app_label, self.model_name)
        table_name = model._meta.db_table
        with schema_editor.connection.cursor() as cursor:
            existing_constraints = schema_editor.connection.introspection.get_constraints(
                cursor, table_name
            )
        if self.name not in existing_constraints:
            return
        super().database_forwards(app_label, schema_editor, from_state, to_state)


class Migration(migrations.Migration):

    dependencies = [
        ("progress", "0038_merge_0008b_and_0037"),
    ]

    operations = [
        SafeRemoveConstraint(
            model_name="lessonprogress",
            name="progress_lessonprogress_attempt_count_gte_0",
        ),
        migrations.AlterField(
            model_name="lessonprogress",
            name="attempt_count",
            field=models.IntegerField(default=0),
        ),
    ]
