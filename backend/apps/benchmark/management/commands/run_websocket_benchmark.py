"""
Management command to run WebSocket benchmarks.
"""

import asyncio
import json

from django.core.management.base import BaseCommand

from apps.benchmark.websocket_benchmark import WebSocketBenchmark


class Command(BaseCommand):
    """
    Run WebSocket performance benchmarks.

    Usage:
        python manage.py run_websocket_benchmark
        python manage.py run_websocket_benchmark --clients 100
        python manage.py run_websocket_benchmark --format json
    """

    help = "Run WebSocket performance benchmarks"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clients", type=int, default=50, help="Number of concurrent clients"
        )
        parser.add_argument(
            "--messages", type=int, default=10, help="Messages per client"
        )
        parser.add_argument(
            "--broadcasts", type=int, default=5, help="Number of broadcast messages"
        )
        parser.add_argument(
            "--reconnects", type=int, default=50, help="Number of reconnect attempts"
        )
        parser.add_argument(
            "--format",
            type=str,
            default="markdown",
            choices=["markdown", "json"],
            help="Output format",
        )
        parser.add_argument("--output", type=str, help="Output file path")

    def handle(self, *args, **options):
        self.stdout.write("🔌 Running WebSocket benchmarks...")
        self.stdout.write("=" * 60)

        benchmark = WebSocketBenchmark()

        async def run_benchmarks():
            # Run benchmarks
            self.stdout.write("📊 Benchmark: Concurrent Clients")
            await benchmark.benchmark_concurrent_clients(
                num_clients=options["clients"], messages_per_client=options["messages"]
            )

            self.stdout.write("📊 Benchmark: Broadcast Latency")
            await benchmark.benchmark_broadcast_latency(
                num_clients=min(options["clients"], 50),
                broadcasts=options["broadcasts"],
            )

            self.stdout.write("📊 Benchmark: Reconnect Performance")
            await benchmark.benchmark_reconnect_performance(
                num_reconnects=options["reconnects"]
            )

        # Run the async benchmarks
        asyncio.run(run_benchmarks())

        # Generate report
        if options["format"] == "json":
            content = json.dumps(benchmark.generate_report(), indent=2)
            ext = "json"
        else:
            content = benchmark.generate_markdown_report()
            ext = "md"

        # Print summary table to stdout
        self.stdout.write("")
        self.stdout.write("=" * 60)
        self.stdout.write("📋 Benchmark Summary")
        self.stdout.write("=" * 60)
        for result in benchmark.results:
            self.stdout.write(f"\n  {result.name}")
            self.stdout.write(f"    Clients: {result.concurrent_clients}")
            self.stdout.write(f"    Messages: {result.total_messages}")
            self.stdout.write(f"    Time: {result.total_time:.2f}s")
            self.stdout.write(f"    Avg Latency: {result.avg_latency:.2f}ms")
            self.stdout.write(f"    P95 Latency: {result.p95_latency:.2f}ms")
            self.stdout.write(f"    Messages/sec: {result.messages_per_second:.2f}")
            self.stdout.write(f"    Peak Memory: {result.peak_memory_mb:.2f} MB")
            self.stdout.write(f"    RSS Memory: {result.memory_usage_mb:.2f} MB")
            self.stdout.write(
                f"    Success: {result.success_count}/{result.success_count + result.failure_count}"
            )
        self.stdout.write("")

        if options["output"]:
            with open(options["output"], "w") as f:
                f.write(content)
            self.stdout.write(f"\n✅ Report saved to {options['output']}")
        else:
            self.stdout.write("\n" + content)

        self.stdout.write("\n✅ Benchmark complete!")
