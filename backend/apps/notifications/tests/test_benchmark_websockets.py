import json
from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db(transaction=True)
def test_benchmark_websockets_command_execution():
    """Verify that python manage.py benchmark_websockets runs successfully and produces latency metrics."""
    out = StringIO()
    call_command(
        "benchmark_websockets",
        clients=5,
        broadcasts=3,
        delay=0.01,
        stdout=out,
    )
    output = out.getvalue()

    assert "Starting WebSocket Broadcast Benchmark" in output
    assert "Connected Clients" in output
    assert "Latency: P95" in output
    assert "Latency: P99" in output
    assert "WebSocket broadcast load benchmark completed" in output


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_benchmark_websockets_run_benchmark_metrics():
    """Verify that run_benchmark returns properly structured metrics and percentile keys."""
    from apps.notifications.management.commands.benchmark_websockets import Command

    cmd = Command()
    results = await cmd.run_benchmark(
        clients_count=3,
        broadcasts_count=2,
        delay=0.01,
        endpoint="/ws/leaderboard/",
        group_name="leaderboard",
        timeout=3.0,
    )

    assert results["clients_connected"] == 3
    assert results["broadcasts_emitted"] == 2
    assert results["messages_received"] == 6
    assert results["success_rate_percent"] == 100.0
    assert "latency_p95_ms" in results
    assert "latency_p99_ms" in results
    assert results["latency_p95_ms"] >= 0.0
    assert results["latency_p99_ms"] >= 0.0
