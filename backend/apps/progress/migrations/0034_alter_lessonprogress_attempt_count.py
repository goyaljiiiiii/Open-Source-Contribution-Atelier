from django.db import migrations, models


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
        migrations.AddConstraint(
            model_name="lessonprogress",
            constraint=models.CheckConstraint(
                check=models.Q(attempt_count__gte=0),
                name="progress_lessonprogress_attempt_count_gte_0",
            ),
        ),
    ]
