from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("progress", "0008a_backfill_lessonprogress_scores"),
    ]
    operations = [
        migrations.AlterField(
            model_name="lessonprogress",
            name="base_score",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="lessonprogress",
            name="multiplier_applied",
            field=models.FloatField(default=1.0),
        ),
    ]
