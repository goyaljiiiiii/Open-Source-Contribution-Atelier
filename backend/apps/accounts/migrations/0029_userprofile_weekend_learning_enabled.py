from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0028_totpdevice"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="weekend_learning_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Whether weekend learning activity is part of the user's normal schedule",
            ),
        ),
    ]
