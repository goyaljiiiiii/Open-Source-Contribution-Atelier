from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("oauth", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="oauthtoken",
            name="last_sync",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
