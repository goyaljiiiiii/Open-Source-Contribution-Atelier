import logging
import time

from django.db import OperationalError, close_old_connections

logger = logging.getLogger(__name__)


class DatabaseConnectionGuardMiddleware:
    """
    Retry safe idempotent requests when the database connection drops.

    This retries the whole request, not a single ORM statement, so it is
    intentionally limited to GET/HEAD/OPTIONS where a replay is safe.
    """

    safe_methods = {"GET", "HEAD", "OPTIONS"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        close_old_connections()
        max_retries = 3
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                response = self.get_response(request)
                close_old_connections()
                return response
            except OperationalError as exc:
                last_error = exc
                close_old_connections()

                if request.method not in self.safe_methods or attempt == max_retries:
                    logger.exception(
                        "Database request failed after %s attempts for %s %s",
                        attempt + 1,
                        request.method,
                        request.path,
                    )
                    raise

                backoff_seconds = min(2.0, 0.25 * (2**attempt))
                logger.warning(
                    "OperationalError on %s %s, retrying in %.2fs (%s/%s)",
                    request.method,
                    request.path,
                    backoff_seconds,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(backoff_seconds)

        if last_error is not None:
            raise last_error