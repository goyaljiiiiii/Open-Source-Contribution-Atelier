from django.db import migrations, models


class SafeAddConstraint(migrations.AddConstraint):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        sid = schema_editor.connection.savepoint()
        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
            schema_editor.connection.savepoint_commit(sid)
        except Exception as e:
            schema_editor.connection.savepoint_rollback(sid)
            if "already exists" in str(e).lower():
                pass
            else:
                raise


class Migration(migrations.Migration):

    dependencies = [
        ("progress", "0021_lessonbookmark"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="userbadge",
            unique_together=set(),
        ),
        SafeAddConstraint(
            model_name="userbadge",
            constraint=models.UniqueConstraint(
                fields=("user", "badge"), name="unique_user_badge_award"
            ),
        ),
    ]
