"""Locust stress test for database connection exhaustion.

Run with:
    locust -f locustfile.py --host http://127.0.0.1:8000 --users 200 --spawn-rate 50
"""

from __future__ import annotations

from gevent.lock import Semaphore
from locust import HttpUser, task, between, events

MAX_ALLOWED_CONNECTIONS = 90
_max_seen_connections = 0
_lock = Semaphore()


def _record_connection_count(count: int) -> None:
    global _max_seen_connections
    with _lock:
        if count > _max_seen_connections:
            _max_seen_connections = count


@events.quitting.add_listener
def _assert_connection_ceiling(environment, **kwargs):
    if _max_seen_connections >= MAX_ALLOWED_CONNECTIONS:
        raise AssertionError(
            f"Database connections exceeded ceiling: {_max_seen_connections} >= {MAX_ALLOWED_CONNECTIONS}"
        )


class DbHealthUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task
    def db_health(self):
        with self.client.get(
            "/api/health/db/", name="/api/health/db/", catch_response=True
        ) as response:
            if response.status_code != 200:
                response.failure(f"Unexpected status {response.status_code}")
                return

            payload = response.json()
            total = int(payload.get("total", 0))
            _record_connection_count(total)

            if total >= MAX_ALLOWED_CONNECTIONS:
                response.failure(f"Connection count too high: {total}")