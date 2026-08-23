from django.db import migrations, models


class SafeAlterUniqueTogether(migrations.AlterUniqueTogether):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor == "postgresql":
            model_name = getattr(self, "name", getattr(self, "model_name", None))
            model = from_state.apps.get_model(app_label, model_name)
            table_name = model._meta.db_table
            with schema_editor.connection.cursor() as cursor:
                constraints = schema_editor.connection.introspection.get_constraints(
                    cursor, table_name
                )
            has_unique = any(
                c_info.get("unique") and set(c_info.get("columns", [])) == {"user_id", "badge_id"}
                for c_info in constraints.values()
            )
            if not has_unique:
                return
        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
        except Exception:
            pass


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
        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
        except Exception:
            pass


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ("progress", "0021_lessonbookmark"),
    ]

    operations = [
        SafeAlterUniqueTogether(
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
