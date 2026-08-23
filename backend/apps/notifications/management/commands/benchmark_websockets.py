import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application

logger = logging.getLogger(__name__)
User = get_user_model()


@database_sync_to_async
def get_or_create_benchmark_user():
    """Retrieve or generate a test user for authenticating benchmark clients."""
    user, _ = User.objects.get_or_create(
        username="ws_benchmark_runner",
        defaults={
            "email": "ws_benchmark_runner@example.com",
            "is_active": True,
        },
    )
    return user


@database_sync_to_async
def generate_auth_token(user):
    """Generate a JWT token for the benchmark user."""
    return str(AccessToken.for_user(user))


class Command(BaseCommand):
    help = (
        "Run a load test benchmark fixture for WebSocket broadcast channels with "
        "simulated concurrent clients, measuring P95 / P99 latency."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clients",
            type=int,
            default=100,
            help="Number of concurrent simulated WebSocket clients to connect (default: 100)",
        )
        parser.add_argument(
            "--broadcasts",
            type=int,
            default=10,
            help="Number of broadcast messages to emit (default: 10)",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=0.05,
            help="Delay in seconds between consecutive broadcasts (default: 0.05)",
        )
        parser.add_argument(
            "--endpoint",
            type=str,
            default="/ws/leaderboard/",
            help="WebSocket endpoint path to benchmark (default: /ws/leaderboard/)",
        )
        parser.add_argument(
            "--group",
            type=str,
            default="leaderboard",
            help="Channel layer group name for broadcasts (default: leaderboard)",
        )
        parser.add_argument(
            "--timeout",
            type=float,
            default=5.0,
            help="Communicator receive timeout in seconds (default: 5.0)",
        )

    def handle(self, *args, **options):
        clients_count = options["clients"]
        broadcasts_count = options["broadcasts"]
        delay = options["delay"]
        endpoint = options["endpoint"]
        group_name = options["group"]
        timeout = options["timeout"]

        self.stdout.write(
            self.style.NOTICE(
                f"\n🚀 Starting WebSocket Broadcast Benchmark:\n"
                f"   • Concurrent Clients: {clients_count}\n"
                f"   • Broadcast Messages: {broadcasts_count}\n"
                f"   • Endpoint:           {endpoint}\n"
                f"   • Channel Group:      {group_name}\n"
            )
        )

        results = asyncio.run(
            self.run_benchmark(
                clients_count=clients_count,
                broadcasts_count=broadcasts_count,
                delay=delay,
                endpoint=endpoint,
                group_name=group_name,
                timeout=timeout,
            )
        )

        self.display_results(results)
        return json.dumps(results) if not self.stdout.isatty() else None

    async def run_benchmark(
        self,
        clients_count: int,
        broadcasts_count: int,
        delay: float,
        endpoint: str,
        group_name: str,
        timeout: float,
    ) -> Dict[str, Any]:
        """Execute concurrent client connections, dispatch broadcasts, and measure delivery latencies."""
        user = await get_or_create_benchmark_user()
        token = await generate_auth_token(user)

        channel_layer = get_channel_layer()
        if not channel_layer:
            self.stderr.write(self.style.ERROR("Channel layer is not configured!"))
            return {"error": "Channel layer not configured"}

        communicators: List[WebsocketCommunicator] = []
        connection_failures = 0
        connect_start = time.perf_counter()

        headers = [(b"origin", b"http://localhost")]
        url = f"{endpoint}?token={token}"

        # Connect clients concurrently
        async def connect_client(index: int) -> Optional[WebsocketCommunicator]:
            comm = WebsocketCommunicator(application, url, headers=headers)
            try:
                connected, _ = await comm.connect(timeout=timeout)
                if connected:
                    return comm
                else:
                    await comm.disconnect()
                    return None
            except Exception as e:
                logger.debug("Failed connecting client %d: %s", index, e)
                return None

        connect_tasks = [connect_client(i) for i in range(clients_count)]
        connected_results = await asyncio.gather(*connect_tasks)

        for comm in connected_results:
            if comm:
                communicators.append(comm)
            else:
                connection_failures += 1

        connected_count = len(communicators)
        connect_duration = time.perf_counter() - connect_start

        if connected_count == 0:
            return {
                "clients_requested": clients_count,
                "clients_connected": 0,
                "connection_failures": connection_failures,
                "error": "All client connection attempts failed",
            }

        latencies: List[float] = []
        messages_received = 0
        broadcast_start_time = time.perf_counter()

        # Run broadcast rounds
        for round_idx in range(broadcasts_count):
            t_send = time.perf_counter()
            msg_payload = {
                "type": "leaderboard_update",
                "event": "benchmark_broadcast",
                "user_id": user.id,
                "username": user.username,
                "xp": round_idx * 10,
                "message": f"Broadcast message #{round_idx + 1}",
                "benchmark_ts": t_send,
            }

            # Send group message
            await channel_layer.group_send(group_name, msg_payload)

            # Receive on all communicators concurrently
            async def receive_broadcast(comm: WebsocketCommunicator) -> Optional[float]:
                try:
                    data = await comm.receive_json_from(timeout=timeout)
                    t_recv = time.perf_counter()
                    if isinstance(data, dict):
                        latency_ms = (t_recv - t_send) * 1000.0
                        return latency_ms
                except Exception as e:
                    logger.debug("Receive timed out or failed: %s", e)
                    return None
                return None

            recv_tasks = [receive_broadcast(c) for c in communicators]
            round_latencies = await asyncio.gather(*recv_tasks)

            for lat in round_latencies:
                if lat is not None:
                    latencies.append(lat)
                    messages_received += 1

            if delay > 0 and round_idx < broadcasts_count - 1:
                await asyncio.sleep(delay)

        total_broadcast_time = time.perf_counter() - broadcast_start_time

        # Disconnect clients
        disconnect_tasks = [comm.disconnect() for comm in communicators]
        await asyncio.gather(*disconnect_tasks, return_exceptions=True)

        # Compute percentile metrics
        expected_total = connected_count * broadcasts_count
        sorted_latencies = sorted(latencies)
        total_samples = len(sorted_latencies)

        min_lat = sorted_latencies[0] if total_samples > 0 else 0.0
        max_lat = sorted_latencies[-1] if total_samples > 0 else 0.0
        avg_lat = sum(sorted_latencies) / total_samples if total_samples > 0 else 0.0

        p50_idx = int(total_samples * 0.50)
        p95_idx = int(total_samples * 0.95)
        p99_idx = int(total_samples * 0.99)

        p50_lat = (
            sorted_latencies[min(p50_idx, max(0, total_samples - 1))]
            if total_samples > 0
            else 0.0
        )
        p95_lat = (
            sorted_latencies[min(p95_idx, max(0, total_samples - 1))]
            if total_samples > 0
            else 0.0
        )
        p99_lat = (
            sorted_latencies[min(p99_idx, max(0, total_samples - 1))]
            if total_samples > 0
            else 0.0
        )

        msg_rate = (
            messages_received / total_broadcast_time
            if total_broadcast_time > 0
            else 0.0
        )
        success_rate = (
            (messages_received / expected_total) * 100.0 if expected_total > 0 else 0.0
        )

        return {
            "clients_requested": clients_count,
            "clients_connected": connected_count,
            "connection_failures": connection_failures,
            "connection_duration_sec": round(connect_duration, 4),
            "broadcasts_emitted": broadcasts_count,
            "messages_expected": expected_total,
            "messages_received": messages_received,
            "success_rate_percent": round(success_rate, 2),
            "total_broadcast_duration_sec": round(total_broadcast_time, 4),
            "throughput_messages_per_sec": round(msg_rate, 2),
            "latency_min_ms": round(min_lat, 2),
            "latency_avg_ms": round(avg_lat, 2),
            "latency_p50_ms": round(p50_lat, 2),
            "latency_p95_ms": round(p95_lat, 2),
            "latency_p99_ms": round(p99_lat, 2),
            "latency_max_ms": round(max_lat, 2),
        }

    def display_results(self, res: Dict[str, Any]):
        """Render a formatted ASCII metrics summary table to standard output."""
        if "error" in res and res.get("clients_connected", 0) == 0:
            self.stdout.write(
                self.style.ERROR(f"\n❌ Benchmark Failed: {res.get('error')}\n")
            )
            return

        conn_clients = str(res["clients_connected"])
        conn_fails = str(res["connection_failures"])
        conn_setup = f"{res['connection_duration_sec']}s"
        broadcasts_cnt = str(res["broadcasts_emitted"])
        msg_ratio = f"{res['messages_received']} / {res['messages_expected']}"
        success_pct = f"{res['success_rate_percent']} %"
        total_time = f"{res['total_broadcast_duration_sec']}s"
        throughput = f"{res['throughput_messages_per_sec']} msg/s"
        lat_min = f"{res['latency_min_ms']} ms"
        lat_avg = f"{res['latency_avg_ms']} ms"
        lat_p50 = f"{res['latency_p50_ms']} ms"
        lat_p95 = f"{res['latency_p95_ms']} ms"
        lat_p99 = f"{res['latency_p99_ms']} ms"
        lat_max = f"{res['latency_max_ms']} ms"

        table = [
            "┌────────────────────────────────────────────────────────┬──────────────────────┐",
            "│ WebSocket Benchmark Metric                             │ Value                │",
            "├────────────────────────────────────────────────────────┼──────────────────────┤",
            f"│ Connected Clients                                      │ {conn_clients:<20} │",
            f"│ Connection Failures                                    │ {conn_fails:<20} │",
            f"│ Connection Setup Time                                  │ {conn_setup:<20} │",
            f"│ Broadcasts Emitted                                     │ {broadcasts_cnt:<20} │",
            f"│ Messages Received / Expected                           │ {msg_ratio:<20} │",
            f"│ Delivery Success Rate                                  │ {success_pct:<20} │",
            f"│ Total Benchmark Time                                   │ {total_time:<20} │",
            f"│ Throughput (Messages / sec)                            │ {throughput:<20} │",
            "├────────────────────────────────────────────────────────┼──────────────────────┤",
            f"│ Latency: Min                                           │ {lat_min:<20} │",
            f"│ Latency: Avg                                           │ {lat_avg:<20} │",
            f"│ Latency: Median (P50)                                  │ {lat_p50:<20} │",
            f"│ Latency: P95                                           │ {lat_p95:<20} │",
            f"│ Latency: P99                                           │ {lat_p99:<20} │",
            f"│ Latency: Max                                           │ {lat_max:<20} │",
            "└────────────────────────────────────────────────────────┴──────────────────────┘",
        ]

        self.stdout.write("\n" + "\n".join(table) + "\n")
        self.stdout.write(
            self.style.SUCCESS("✅ WebSocket broadcast load benchmark completed.\n")
        )
