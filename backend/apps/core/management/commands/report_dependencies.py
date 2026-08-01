"""
Management command to output a CSV of all direct and transitive dependencies
with versions, licenses, and latest available version for audit purposes.

Usage:
    python manage.py report_dependencies [--format csv|json] [--output dependencies.csv]
"""

import csv
import json
import subprocess
import sys
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Output a dependency report with versions, licenses, and latest available versions"

    def add_arguments(self, parser):
        parser.add_argument(
            "--format",
            choices=["csv", "json"],
            default="csv",
            help="Output format (default: csv)",
        )
        parser.add_argument(
            "--output",
            default=None,
            help="Output file path (default: stdout)",
        )

    def _get_pip_deps(self):
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "list", "--format=json"],
                capture_output=True,
                text=True,
                check=True,
            )
            return json.loads(result.stdout)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            self.stderr.write(self.style.ERROR(f"Failed to list pip packages: {e}"))
            return []

    def _get_pip_licenses(self):
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "list", "--format=json", "--verbose"],
                capture_output=True,
                text=True,
                check=True,
            )
            return json.loads(result.stdout)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            self.stderr.write(self.style.WARNING(f"Failed to get pip licenses: {e}"))
            return []

    def _get_latest_version(self, package_name):
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "index", "versions", package_name],
                capture_output=True,
                text=True,
                timeout=10,
            )
            for line in result.stdout.splitlines():
                if line.startswith("Available versions:"):
                    versions = line.split(":", 1)[1].strip()
                    latest = versions.split(",")[0].strip()
                    return latest
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        return "unknown"

    def _build_license_map(self, pip_list_verbose):
        license_map = {}
        for pkg in pip_list_verbose:
            name = pkg.get("name", "").lower()
            license_map[name] = pkg.get("license", "Unknown")
        return license_map

    def handle(self, *args, **options):
        output_format = options["format"]
        output_path = options["output"]

        deps = self._get_pip_deps()
        verbose_deps = self._get_pip_licenses()
        license_map = self._build_license_map(verbose_deps)

        rows = []
        for dep in deps:
            name = dep.get("name", "")
            version = dep.get("version", "")
            latest = self._get_latest_version(name)
            license_name = license_map.get(name.lower(), "Unknown")
            rows.append({
                "name": name,
                "version": version,
                "license": license_name,
                "latest_version": latest,
                "ecosystem": "pip",
            })

        if output_format == "json":
            output = json.dumps(rows, indent=2)
        else:
            output = self._to_csv(rows)

        if output_path:
            Path(output_path).write_text(output)
            self.stdout.write(self.style.SUCCESS(f"Report written to {output_path}"))
        else:
            self.stdout.write(output)

    def _to_csv(self, rows):
        if not rows:
            return "name,version,license,latest_version,ecosystem\n"
        output = []
        fieldnames = ["name", "version", "license", "latest_version", "ecosystem"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return "".join(output)
