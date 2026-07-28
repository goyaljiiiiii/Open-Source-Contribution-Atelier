import logging

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.security.models import AutoFixPR, ProjectDependency

logger = logging.getLogger(__name__)


@shared_task
def scan_project_dependencies():
    """
    Fetches real Dependabot alerts from GitHub to track dependency decay and auto-PRs.
    Handles pagination and cleans up stale/closed alerts and PRs.
    """
    token = getattr(settings, "GITHUB_TOKEN", None)
    if not token:
        logger.warning("GITHUB_TOKEN not set. Cannot fetch Dependabot alerts.")
        return "GITHUB_TOKEN missing."

    repo = getattr(settings, "GITHUB_REPO_NAME", None)
    if not repo:
        logger.error(
            "GITHUB_REPO_NAME not set. Aborting to avoid syncing incorrect repo data."
        )
        return "GITHUB_REPO_NAME missing."

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    # 1. Fetch Dependabot alerts with pagination
    alerts_url = f"https://api.github.com/repos/{repo}/dependabot/alerts?per_page=100"
    active_packages = set()
    processed_count = 0

    try:
        while alerts_url:
            response = requests.get(alerts_url, headers=headers)
            if response.status_code == 200:
                alerts = response.json()
                for alert in alerts:
                    if alert.get("state") != "open":
                        continue

                    dependency = alert.get("dependency", {})
                    package_name = dependency.get("package", {}).get("name", "unknown")
                    ecosystem = dependency.get("package", {}).get(
                        "ecosystem", "unknown"
                    )

                    active_packages.add((package_name, ecosystem))

                    current_version = "unknown"
                    latest_version = "unknown"

                    security_vulnerability = alert.get("security_vulnerability", {})
                    first_patched_version = security_vulnerability.get(
                        "first_patched_version", {}
                    )
                    if first_patched_version and first_patched_version.get(
                        "identifier"
                    ):
                        latest_version = first_patched_version.get("identifier")

                    created_at_str = alert.get("created_at")
                    days_vulnerable = 0
                    if created_at_str:
                        from dateutil.parser import parse

                        created_at = parse(created_at_str)
                        days_vulnerable = (timezone.now() - created_at).days

                    severity = security_vulnerability.get("severity", "low")
                    decay_rate = {
                        "critical": 1.0,
                        "high": 0.8,
                        "medium": 0.5,
                        "low": 0.2,
                    }.get(severity, 0.1)
                    security_score = max(0, 100 - int(decay_rate * 100))

                    ProjectDependency.objects.update_or_create(
                        package_name=package_name,
                        ecosystem=ecosystem,
                        defaults={
                            "current_version": current_version,
                            "latest_version": latest_version,
                            "days_vulnerable": days_vulnerable,
                            "decay_rate": decay_rate,
                            "security_score": security_score,
                        },
                    )
                    processed_count += 1

                # Check for next page
                links = response.links
                if "next" in links:
                    alerts_url = links["next"]["url"]
                else:
                    alerts_url = None
            else:
                logger.error(
                    f"Failed to fetch Dependabot alerts: {response.status_code} {response.text}"
                )
                alerts_url = None

        logger.info(f"Processed {processed_count} active Dependabot alerts.")

        # Cleanup stale dependencies that no longer have an open alert
        all_deps = ProjectDependency.objects.all()
        for dep in all_deps:
            if (dep.package_name, dep.ecosystem) not in active_packages:
                dep.delete()

    except Exception as e:
        logger.error(f"Error fetching Dependabot alerts: {e}")

    # 2. Fetch Dependabot created PRs with pagination
    # We fetch all states to properly close out merged/closed ones
    pulls_url = f"https://api.github.com/repos/{repo}/pulls?state=all&per_page=100"
    try:
        while pulls_url:
            response = requests.get(pulls_url, headers=headers)
            if response.status_code == 200:
                prs = response.json()
                for pr in prs:
                    if pr.get("user", {}).get("login") == "dependabot[bot]":
                        pr_number = pr.get("number")
                        pr_url = pr.get("html_url")
                        title = pr.get("title", "")
                        state = pr.get("state", "open").upper()

                        if pr.get("merged_at"):
                            state = "MERGED"

                        # Only track if it's already in DB, or if it's currently open
                        exists = AutoFixPR.objects.filter(pr_number=pr_number).exists()
                        if state == "OPEN" or exists:
                            AutoFixPR.objects.update_or_create(
                                pr_number=pr_number,
                                defaults={
                                    "pr_url": pr_url,
                                    "status": state,
                                    "packages_updated": [title],
                                },
                            )

                links = response.links
                if "next" in links:
                    pulls_url = links["next"]["url"]
                else:
                    pulls_url = None
            else:
                logger.error(
                    f"Failed to fetch PRs: {response.status_code} {response.text}"
                )
                pulls_url = None

        logger.info("Synced Dependabot PRs.")
    except Exception as e:
        logger.error(f"Error syncing Dependabot PRs: {e}")

    return "Scan complete."
