from django.db import migrations

def backfill(apps, schema_editor):
    LessonProgress = apps.get_model("progress", "LessonProgress")
    BATCH = 5000
    qs = LessonProgress.objects.order_by("pk")
    last = None
    while True:
        rows = qs.filter(pk__gt=last)[:BATCH] if last else qs[:BATCH]
        rows = list(rows)
        if not rows:
            break
        for row in rows:
            row.base_score = 0
            row.multiplier_applied = 1.0
        LessonProgress.objects.bulk_update(rows, ["base_score", "multiplier_applied"])
        last = rows[-1].pk

class Migration(migrations.Migration):
    dependencies = [
        ("progress", "0008_xpmultiplierevent_lessonprogress_base_score_and_more"),
    ]
    operations = [
        migrations.RunPython(backfill, reverse_code=migrations.RunPython.noop),
    ]
