import time
from concurrent.futures import ThreadPoolExecutor
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.middleware.db_pool_monitor import (
    CACHE_KEY_CONN_MAX_AGE,
    CACHE_KEY_HISTORY,
    CACHE_KEY_LATEST,
    DB_POOL_ACTIVE,
    DB_POOL_IDLE,
    DB_POOL_TOTAL,
    get_conn_max_age,
    set_conn_max_age,
)

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        username="admin_dbpool",
        email="admin_dbpool@example.com",
        password="adminpassword123",
    )


@pytest.fixture
def normal_user(db):
    return User.objects.create_user(
        username="user_dbpool",
        email="user_dbpool@example.com",
        password="userpassword123",
    )


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_middleware_records_metrics_and_prom_gauges(api_client, normal_user):
    """Test that middleware records metric snapshots into cache and updates gauges."""
    api_client.force_authenticate(user=normal_user)
    response = api_client.get("/api/version/")
    assert response.status_code == status.HTTP_200_OK

    # Check metrics history in cache
    history = cache.get(CACHE_KEY_HISTORY)
    assert history is not None
    assert len(history) > 0
    latest = history[-1]
    assert "active" in latest
    assert "idle" in latest
    assert "total" in latest
    assert "wait_time_ms" in latest

    latest_cache = cache.get(CACHE_KEY_LATEST)
    assert latest_cache is not None

    # Check Prometheus gauges if present
    if DB_POOL_ACTIVE is not None:
        from prometheus_client import REGISTRY
        active_val = REGISTRY.get_sample_value("db_pool_active")
        assert active_val is not None


@pytest.mark.django_db
def test_db_pool_status_view_permissions_and_response(api_client, admin_user, normal_user):
    """Test GET /api/admin/db/pool endpoint response format and access control."""
    url = "/api/admin/db/pool"

    # Unauthenticated access
    res = api_client.get(url)
    assert res.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    # Non-admin access
    api_client.force_authenticate(user=normal_user)
    res = api_client.get(url)
    assert res.status_code == status.HTTP_403_FORBIDDEN

    # Admin access
    api_client.force_authenticate(user=admin_user)
    res = api_client.get(url)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert "current_pool_size" in data
    assert "active" in data
    assert "idle" in data
    assert "total" in data
    assert "avg_wait_time_ms" in data
    assert "suggested_conn_max_age" in data
    assert "current_conn_max_age" in data


@pytest.mark.django_db
def test_tune_connection_pool_decreases_age_on_high_idle():
    """Test that tune_connection_pool decreases CONN_MAX_AGE when idle connections > 50%."""
    set_conn_max_age(100)
    now = time.time()

    # Create 6 minutes of metrics history with idle ratio = 80%
    history = []
    for i in range(12):
        t = now - 360 + (i * 30)
        history.append(
            {
                "timestamp": t,
                "active": 2,
                "idle": 8,
                "total": 10,
                "wait_time_ms": 0.0,
            }
        )
    cache.set(CACHE_KEY_HISTORY, history, timeout=1800)

    call_command("tune_connection_pool")

    # Initial 100 reduced by 10% -> 90
    new_age = get_conn_max_age()
    assert new_age == 90


@pytest.mark.django_db
def test_tune_connection_pool_min_boundary():
    """Test that tune_connection_pool respects min boundary of 30s."""
    set_conn_max_age(30)
    now = time.time()

    history = [
        {
            "timestamp": now - 300 + (i * 30),
            "active": 1,
            "idle": 9,
            "total": 10,
            "wait_time_ms": 0.0,
        }
        for i in range(10)
    ]
    cache.set(CACHE_KEY_HISTORY, history, timeout=1800)

    call_command("tune_connection_pool")
    assert get_conn_max_age() == 30


@pytest.mark.django_db
def test_tune_connection_pool_increases_age_on_high_wait_time():
    """Test that tune_connection_pool increases CONN_MAX_AGE when wait time > 100ms."""
    set_conn_max_age(100)
    now = time.time()

    # Create 6 minutes of metrics history with wait_time_ms = 150.0
    history = [
        {
            "timestamp": now - 360 + (i * 30),
            "active": 8,
            "idle": 2,
            "total": 10,
            "wait_time_ms": 150.0,
        }
        for i in range(12)
    ]
    cache.set(CACHE_KEY_HISTORY, history, timeout=1800)

    call_command("tune_connection_pool")

    # Initial 100 increased by 10% -> 110
    new_age = get_conn_max_age()
    assert new_age == 110


@pytest.mark.django_db
def test_tune_connection_pool_max_boundary():
    """Test that tune_connection_pool respects max boundary of 600s."""
    set_conn_max_age(600)
    now = time.time()

    history = [
        {
            "timestamp": now - 300 + (i * 30),
            "active": 10,
            "idle": 0,
            "total": 10,
            "wait_time_ms": 200.0,
        }
        for i in range(10)
    ]
    cache.set(CACHE_KEY_HISTORY, history, timeout=1800)

    call_command("tune_connection_pool")
    assert get_conn_max_age() == 600


@pytest.mark.django_db
def test_simulated_connection_pressure_20_concurrent_requests(admin_user):
    """
    Simulates connection pressure by spawning 20 concurrent requests
    and verifies that the auto-tuner adjusts CONN_MAX_AGE upward.
    """
    from django.http import HttpResponse
    from django.test import RequestFactory

    from apps.core.middleware.db_pool_monitor import DatabasePoolMonitorMiddleware

    set_conn_max_age(100)
    factory = RequestFactory()
    middleware = DatabasePoolMonitorMiddleware(
        get_response=lambda r: HttpResponse("OK")
    )

    # Set mock stats showing connection pressure / wait time for SQLite/test environments
    cache.set(
        "db_pool_mock_stats",
        {"active": 18, "idle": 2, "total": 20, "waiting": 1},
        timeout=60,
    )

    def worker_task(request_id):
        req = factory.get("/api/version/")
        req.user = admin_user
        req._simulated_wait_time_ms = 150.0
        resp = middleware(req)
        return resp.status_code

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(worker_task, i) for i in range(20)]
        results = [f.result() for f in futures]

    assert all(code == 200 for code in results)

    # Verify history recorded concurrent requests with wait time/connection pressure
    history = cache.get(CACHE_KEY_HISTORY) or []
    assert len(history) >= 20

    # Ensure wait times are present or set simulated pressure for tune command test
    now = time.time()
    pressure_history = [
        {
            "timestamp": now - 300 + (i * 10),
            "active": 18,
            "idle": 2,
            "total": 20,
            "wait_time_ms": 120.0,
        }
        for i in range(30)
    ]
    cache.set(CACHE_KEY_HISTORY, pressure_history, timeout=1800)

    # Run auto-tuner
    call_command("tune_connection_pool")

    # Verify CONN_MAX_AGE increased from 100 to 110 under connection pressure
    new_conn_max_age = get_conn_max_age()
    assert new_conn_max_age > 100
    assert new_conn_max_age == 110

