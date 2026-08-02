import logging

from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Refreshes the progress_leaderboard_mv materialized view concurrently."

    def handle(self, *args, **options):
        self.stdout.write("Refreshing progress_leaderboard_mv...")
        try:
            with connection.cursor() as cursor:
                # CONCURRENTLY requires a unique index on the MV which we created.
                cursor.execute(
                    "REFRESH MATERIALIZED VIEW CONCURRENTLY progress_leaderboard_mv;"
                )
            self.stdout.write(
                self.style.SUCCESS("Successfully refreshed progress_leaderboard_mv")
            )
        except Exception as e:
            logger.error(f"Failed to refresh progress_leaderboard_mv: {e}")
            self.stderr.write(self.style.ERROR(f"Error: {e}"))
