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
