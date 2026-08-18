import pytest
from unittest.mock import MagicMock, patch
from apps.health.views import HealthChecker


@pytest.mark.asyncio
async def test_check_celery_healthy():
    checker = HealthChecker()
    mock_inspect = MagicMock()
    mock_inspect.stats.return_value = {"worker1@host": {}}
    mock_inspect.active_queues.return_value = {"worker1@host": []}

    with patch("config.celery.app.control.inspect", return_value=mock_inspect):
        res = await checker.check_celery()
        assert res["name"] == "Celery Worker"
        assert res["status"] == "healthy"
        assert res["details"]["active_workers"] == 1


@pytest.mark.asyncio
async def test_check_celery_unhealthy_no_workers():
    checker = HealthChecker()
    mock_inspect = MagicMock()
    mock_inspect.stats.return_value = None

    with patch("config.celery.app.control.inspect", return_value=mock_inspect):
        res = await checker.check_celery()
        assert res["name"] == "Celery Worker"
        assert res["status"] == "unhealthy"
        assert "No Celery workers" in res["details"]["error"]
