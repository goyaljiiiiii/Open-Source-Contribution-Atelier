import time
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.content.models import Lesson
from apps.progress.models import XPEvent

User = get_user_model()

class Command(BaseCommand):
    help = "Populate database with 1000+ users, 200+ lessons, 500k+ progress events for perf testing in under 30s."

    def handle(self, *args, **options):
        start_time = time.time()
        self.stdout.write("Starting high-performance seed data generation...")

        # 1. Bulk create 1000 users
        existing_users_count = User.objects.count()
        users_to_create = []
        for i in range(1000):
            users_to_create.append(
                User(
                    username=f"perf_user_{existing_users_count + i}",
                    email=f"perf_user_{existing_users_count + i}@perf.test",
                )
            )
        User.objects.bulk_create(users_to_create, batch_size=1000, ignore_conflicts=True)
        all_user_ids = list(User.objects.values_list("id", flat=True)[:1000])

        # 2. Bulk create 200 lessons
        existing_lessons_count = Lesson.objects.count()
        lessons_to_create = []
        for i in range(200):
            idx = existing_lessons_count + i
            lessons_to_create.append(
                Lesson(
                    title=f"Perf Lesson {idx}",
                    slug=f"perf-lesson-{idx}",
                    summary=f"Summary for perf lesson {idx}",
                    content=f"Content body for perf lesson {idx}",
                    difficulty="intermediate",
                    estimated_minutes=15,
                )
            )
        Lesson.objects.bulk_create(lessons_to_create, batch_size=500, ignore_conflicts=True)

        # 3. Bulk create XP events (500k progress events) in chunks
        batch_size = 50000
        total_events = 500000
        for b in range(0, total_events, batch_size):
            events = [
                XPEvent(
                    user_id=random.choice(all_user_ids),
                    amount=random.choice([10, 20, 50, 100]),
                    source="lesson_completion",
                )
                for _ in range(batch_size)
            ]
            XPEvent.objects.bulk_create(events, batch_size=10000)

        elapsed = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(f"Successfully seeded benchmark data in {elapsed:.2f} seconds!"))
