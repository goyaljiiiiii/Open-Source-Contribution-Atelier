import logging
import time

from django.core.cache import cache
from django.core.management.base import BaseCommand

from apps.core.middleware.db_pool_monitor import (
    CACHE_KEY_HISTORY,
    get_conn_max_age,
    set_conn_max_age,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Analyzes DB connection pool metrics from the last 15 minutes and dynamically tunes CONN_MAX_AGE."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate tuning without updating the cached CONN_MAX_AGE.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        now = time.time()

        history = cache.get(CACHE_KEY_HISTORY) or []

        # Filter last 15 minutes (900 seconds)
        cutoff_15m = now - 900
        recent_15m = [e for e in history if e.get("timestamp", 0) >= cutoff_15m]

        current_age = get_conn_max_age()
        new_age = current_age

        if not recent_15m:
            self.stdout.write(
                self.style.NOTICE(
                    f"No pool metrics found in the last 15 minutes. CONN_MAX_AGE remains at {current_age}s."
                )
            )
            return

        # Check time span of available metrics
        span = recent_15m[-1].get("timestamp", now) - recent_15m[0].get("timestamp", now)

        # Filter last 5 minutes (300 seconds) for evaluation
        cutoff_5m = now - 300
        recent_5m = [e for e in history if e.get("timestamp", 0) >= cutoff_5m]

        eval_set = recent_5m if len(recent_5m) > 0 else recent_15m

        avg_idle = sum(e.get("idle", 0) for e in eval_set) / len(eval_set)
        avg_total = sum(e.get("total", 0) for e in eval_set) / len(eval_set)
        avg_wait = sum(e.get("wait_time_ms", 0.0) for e in eval_set) / len(eval_set)

        # Rule 1: High wait time (> 100ms) -> Increase CONN_MAX_AGE by 10% (max 600s)
        if avg_wait > 100.0:
            calculated = int(current_age * 1.1)
            new_age = min(600, max(current_age + 1, calculated))
            reason = f"Average wait time is {avg_wait:.2f}ms (>100ms)"
        # Rule 2: High idle ratio (> 50%) -> Decrease CONN_MAX_AGE by 10% (min 30s)
        elif avg_total > 0 and (avg_idle / avg_total) > 0.5:
            calculated = int(current_age * 0.9)
            new_age = max(30, calculated)
            idle_pct = (avg_idle / avg_total) * 100
            reason = f"Average idle ratio is {idle_pct:.1f}% (>50%)"
        else:
            reason = "Metrics within normal operating parameters"

        if new_age != current_age:
            if not dry_run:
                set_conn_max_age(new_age)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Adjusted CONN_MAX_AGE from {current_age}s to {new_age}s. Reason: {reason}."
                    )
                )
            else:
                self.stdout.write(
                    self.style.NOTICE(
                        f"[DRY RUN] Would adjust CONN_MAX_AGE from {current_age}s to {new_age}s. Reason: {reason}."
                    )
                )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"CONN_MAX_AGE remains optimal at {current_age}s. ({reason})"
                )
            )
