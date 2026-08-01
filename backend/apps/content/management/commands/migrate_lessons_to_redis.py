import logging

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.content.models import Lesson

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Pre-loads all published lesson content into the Redis/cache layer "
        "so that real-time collaborative editing starts fast."
    )

    def handle(self, *args, **options):
        qs = Lesson.objects.all()
        total = qs.count()
        migrated = 0
        errors = 0

        self.stdout.write(f"Migrating {total} lessons to cache ...")

        for lesson in qs.iterator(chunk_size=100):
            try:
                cache_key = f"lesson_doc_{lesson.id}"
                cache.set(cache_key, lesson.content, timeout=86400)
                rev_key = f"lesson_rev_{lesson.id}"
                if cache.get(rev_key) is None:
                    cache.set(rev_key, 0, timeout=86400)
                migrated += 1
            except Exception as e:
                logger.exception("Failed to cache lesson %s", lesson.id)
                self.stdout.write(
                    self.style.ERROR(f"  ✗ lesson {lesson.id} ({lesson.slug}): {e}")
                )
                errors += 1

        self.stdout.write(self.style.SUCCESS(f"Done. {migrated} cached, {errors} errors."))
