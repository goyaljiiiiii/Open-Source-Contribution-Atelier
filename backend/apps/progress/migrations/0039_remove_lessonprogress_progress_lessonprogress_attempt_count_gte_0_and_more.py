from django.db import migrations, models


class SafeRemoveConstraint(migrations.RemoveConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
        except Exception as e:
            if "does not exist" in str(e).lower() or "already exists" in str(e).lower():
                pass
            else:
                raise


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
