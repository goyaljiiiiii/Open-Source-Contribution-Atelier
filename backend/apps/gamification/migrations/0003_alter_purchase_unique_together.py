from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("gamification", "0002_signedcertificate_anticheatflag"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="purchase",
            unique_together=set(),
        ),
    ]
