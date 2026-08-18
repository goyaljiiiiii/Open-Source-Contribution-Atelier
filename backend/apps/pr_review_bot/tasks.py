"""
Celery tasks for PR review bot and PR Code Impact Analysis.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.pr_review_bot.models import CodeIssue, PRReview
from apps.pr_review_bot.services.code_analyzer import CodeAnalyzer
from apps.pr_review_bot.services.impact_analyzer import PRImpactAnalyzer

logger = logging.getLogger(__name__)


@shared_task
def review_pr(repo: str, pr_number: int):
    """
    Review a PR asynchronously.
    """
    logger.info(f"Starting review for PR #{pr_number} in {repo}")

    # Create or update review record
    review, created = PRReview.objects.get_or_create(
        pr_number=pr_number,
        repository=repo,
        defaults={
            "pr_title": f"Pull Request #{pr_number}",
            "pr_author": "contributor",
            "pr_url": f"https://github.com/{repo}/pull/{pr_number}",
            "status": "processing",
        },
    )
    review.status = "processing"
    review.save()

    return {"status": "completed", "pr_number": pr_number}


@shared_task
def analyze_pr_impact_task(
    pr_number: int,
    repository: str,
    changed_files: list,
    added_lines: int = 0,
    deleted_lines: int = 0,
    raw_diff: str = "",
):
    """
    Asynchronously analyzes PR code impact, maps affected test suites,
    runs the ML flaky test prediction model, and records the result.
    """
    logger.info(
        f"Starting PR Code Impact & Flaky Test Analysis for PR #{pr_number} in {repository}"
    )

    analyzer = PRImpactAnalyzer()
    analysis_result = analyzer.analyze_pr_impact(
        pr_number=pr_number,
        repository=repository,
        changed_files=changed_files,
        added_lines=added_lines,
        deleted_lines=deleted_lines,
        raw_diff=raw_diff,
    )

    # Save to PRReview instance if found
    review = PRReview.objects.filter(pr_number=pr_number, repository=repository).first()
    if review:
        review.test_coverage_score = max(0.0, 100.0 - analysis_result["risk_score"])
        review.summary = analysis_result["markdown_comment"]
        review.status = "completed"
        review.processed_at = timezone.now()
        review.save()

    logger.info(
        f"Completed Impact Analysis for PR #{pr_number}. Risk Score: {analysis_result['risk_score']}%"
    )
    return analysis_result
