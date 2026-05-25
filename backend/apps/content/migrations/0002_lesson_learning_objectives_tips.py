from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="learning_objectives",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="lesson",
            name="tips",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
