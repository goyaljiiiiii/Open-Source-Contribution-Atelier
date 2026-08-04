import logging

from celery import shared_task

from apps.core.middleware.db_pool_monitor import fetch_postgres_pool_stats, get_conn_max_age

logger = logging.getLogger(__name__)


@shared_task(name="config.tasks.report_db_connections")
def report_db_connections():
    """Log the current DB connection count and warn when utilization is high."""
    from django.conf import settings

    active, idle, total, waiting = fetch_postgres_pool_stats()
    max_connections = int(getattr(settings, "DB_MAX_CONNECTIONS", 97))
    utilization = round((total / max_connections) * 100, 2) if max_connections else 0.0
    current_conn_max_age = get_conn_max_age()

    payload = {
        "active": active,
        "idle": idle,
        "total": total,
        "waiting": waiting,
        "max_connections": max_connections,
        "utilization_percent": utilization,
        "conn_max_age": current_conn_max_age,
    }

    if utilization >= 80.0:
        logger.warning("Database connection utilization is high: %s", payload)
    else:
        logger.info("Database connection utilization: %s", payload)

    return payload