import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


<<<<<<< HEAD
def create_mv(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
=======
def create_leaderboard_view(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("""
            CREATE VIEW IF NOT EXISTS progress_leaderboard_mv AS
            SELECT
                user_id,
                COALESCE(SUM(xp_delta), 0) as total_xp,
                ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(xp_delta), 0) DESC) as rank
            FROM progress_xpevent
            GROUP BY user_id;
        """)
    else:
>>>>>>> upstream/main
        schema_editor.execute("""
            CREATE MATERIALIZED VIEW progress_leaderboard_mv AS
            SELECT
                user_id,
                SUM(xp_delta) as total_xp,
                RANK() OVER (ORDER BY SUM(xp_delta) DESC) as rank
            FROM progress_xpevent
            GROUP BY user_id;

            CREATE UNIQUE INDEX progress_leaderboard_mv_user_id_idx
            ON progress_leaderboard_mv (user_id);

            CREATE OR REPLACE FUNCTION refresh_leaderboard_trigger_func()
            RETURNS trigger AS $$
            BEGIN
                NOTIFY leaderboard_refresh;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER xp_event_leaderboard_trigger
            AFTER INSERT OR UPDATE OR DELETE ON progress_xpevent
            FOR EACH STATEMENT
            EXECUTE FUNCTION refresh_leaderboard_trigger_func();
        """)
<<<<<<< HEAD
    elif schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("""
            CREATE VIEW IF NOT EXISTS progress_leaderboard_mv AS
            SELECT
                user_id,
                SUM(xp_delta) as total_xp,
                RANK() OVER (ORDER BY SUM(xp_delta) DESC) as rank
            FROM progress_xpevent
            GROUP BY user_id;
        """)


def drop_mv(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
=======


def drop_leaderboard_view(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("DROP VIEW IF EXISTS progress_leaderboard_mv;")
    else:
>>>>>>> upstream/main
        schema_editor.execute("""
            DROP TRIGGER IF EXISTS xp_event_leaderboard_trigger ON progress_xpevent;
            DROP FUNCTION IF EXISTS refresh_leaderboard_trigger_func;
            DROP MATERIALIZED VIEW IF EXISTS progress_leaderboard_mv;
        """)
<<<<<<< HEAD
    elif schema_editor.connection.vendor == "sqlite":
        schema_editor.execute("DROP VIEW IF EXISTS progress_leaderboard_mv;")
=======
>>>>>>> upstream/main


class Migration(migrations.Migration):

    dependencies = [
        ("progress", "0032_season_alter_xpevent_source_type_trackmilestone_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LeaderboardRank",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        primary_key=True,
                        serialize=False,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("total_xp", models.IntegerField()),
                ("rank", models.IntegerField()),
            ],
            options={
                "db_table": "progress_leaderboard_mv",
                "ordering": ["rank"],
                "managed": False,
            },
        ),
<<<<<<< HEAD
        migrations.RunPython(create_mv, drop_mv),
=======
        migrations.RunPython(
            create_leaderboard_view,
            drop_leaderboard_view,
        ),
>>>>>>> upstream/main
    ]

