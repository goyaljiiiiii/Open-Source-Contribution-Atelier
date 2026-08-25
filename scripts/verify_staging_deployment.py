#!/usr/bin/env python3
"""
Automated healthcheck and deployment verification script for staging/production environments.

Usage:
    python scripts/verify_staging_deployment.py --base-url https://staging.atelier.dev --timeout 10 --retries 3
"""

import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("staging-healthcheck")


class StagingDeploymentVerifier:
    def __init__(
        self,
        base_url: str,
        timeout: int = 10,
        retries: int = 3,
        delay: float = 2.0,
        max_latency_ms: float = 1500.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.retries = retries
        self.delay = delay
        self.max_latency_ms = max_latency_ms
        self.results: Dict[str, Any] = {
            "target": self.base_url,
            "timestamp": time.time(),
            "overall_status": "UNKNOWN",
            "checks": {},
            "summary": {"total": 0, "passed": 0, "failed": 0},
        }

    def _fetch_endpoint(self, path: str) -> Tuple[int, Optional[Dict[str, Any]], float, Optional[str]]:
        url = f"{self.base_url}{path}"
        start_time = time.perf_counter()
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "OSCA-Staging-Healthcheck-Verifier/1.0",
                "Accept": "application/json, text/html, */*",
            },
        )

        for attempt in range(1, self.retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    status_code = response.status
                    body = response.read().decode("utf-8")
                    try:
                        data = json.loads(body)
                    except Exception:
                        data = {"raw": body[:200]}
                    return status_code, data, latency_ms, None
            except urllib.error.HTTPError as http_err:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                return http_err.code, None, latency_ms, str(http_err)
            except Exception as exc:
                if attempt < self.retries:
                    time.sleep(self.delay)
                else:
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    return 0, None, latency_ms, str(exc)

        return 0, None, 0.0, "Unknown error"

    def check_liveness(self) -> bool:
        """Verifies HTTP server responds with status 200 on /health/."""
        status_code, data, latency, error = self._fetch_endpoint("/health/")
        passed = status_code == 200 and latency <= self.max_latency_ms
        self.results["checks"]["liveness"] = {
            "endpoint": "/health/",
            "passed": passed,
            "status_code": status_code,
            "latency_ms": latency,
            "error": error,
            "response": data,
        }
        return passed

    def check_readiness(self) -> bool:
        """Verifies core database and services are ready on /health/ready/ or /health/."""
        status_code, data, latency, error = self._fetch_endpoint("/health/ready/")
        if status_code == 404:
            # Fallback to general health endpoint
            status_code, data, latency, error = self._fetch_endpoint("/health/")

        db_ok = True
        if isinstance(data, dict):
            status_field = str(data.get("status", "")).lower()
            db_status = str(data.get("database", data.get("db", "ok"))).lower()
            if status_field in ["unhealthy", "error"] or db_status in ["error", "down"]:
                db_ok = False

        passed = (status_code == 200) and db_ok
        self.results["checks"]["readiness"] = {
            "endpoint": "/health/ready/",
            "passed": passed,
            "status_code": status_code,
            "latency_ms": latency,
            "database_ready": db_ok,
            "error": error,
        }
        return passed

    def check_api_docs(self) -> bool:
        """Verifies OpenAPI schema or Swagger endpoint is reachable."""
        status_code, _, latency, error = self._fetch_endpoint("/api/schema/")
        passed = status_code in (200, 301, 302)
        self.results["checks"]["api_schema"] = {
            "endpoint": "/api/schema/",
            "passed": passed,
            "status_code": status_code,
            "latency_ms": latency,
            "error": error,
        }
        return passed

    def run_all_checks(self) -> bool:
        logger.info(f"Starting deployment verification for {self.base_url}")

        liveness_ok = self.check_liveness()
        readiness_ok = self.check_readiness()
        api_ok = self.check_api_docs()

        passed_count = sum([liveness_ok, readiness_ok, api_ok])
        total_count = 3
        all_passed = passed_count == total_count

        self.results["summary"]["total"] = total_count
        self.results["summary"]["passed"] = passed_count
        self.results["summary"]["failed"] = total_count - passed_count
        self.results["overall_status"] = "HEALTHY" if all_passed else "UNHEALTHY"

        if all_passed:
            logger.info("✅ All deployment health checks passed successfully!")
        else:
            logger.error(f"❌ Deployment healthcheck failed ({passed_count}/{total_count} passed)")

        return all_passed


def main():
    parser = argparse.ArgumentParser(description="Verify staging deployment health")
    parser.add_argument(
        "--base-url",
        default=os.getenv("STAGING_BASE_URL", "http://localhost:8000"),
        help="Base URL of staging environment",
    )
    parser.add_argument("--timeout", type=int, default=10, help="Request timeout in seconds")
    parser.add_argument("--retries", type=int, default=3, help="Number of retry attempts")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between retries in seconds")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")

    args = parser.parse_args()

    verifier = StagingDeploymentVerifier(
        base_url=args.base_url,
        timeout=args.timeout,
        retries=args.retries,
        delay=args.delay,
    )

    success = verifier.run_all_checks()

    if args.json:
        print(json.dumps(verifier.results, indent=2))

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
