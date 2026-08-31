from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("issues", "0003_bounty_badge"),
    ]

    operations = [
        migrations.AddField(
            model_name="issuereport",
            name="is_verified",
            field=models.BooleanField(
                default=False,
                help_text="Designates whether this report is a verified issue.",
            ),
        ),
    ]
