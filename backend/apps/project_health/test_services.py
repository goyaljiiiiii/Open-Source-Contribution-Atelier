from unittest.mock import patch

from apps.project_health.services import analyze_repository, calculate_commit_frequency


def test_calculate_commit_frequency_with_zero_commits_returns_zero():
    """Fresh repositories with no parsed commits should not divide by zero."""
    assert calculate_commit_frequency(0, 0) == 0.0
    assert calculate_commit_frequency(10, 0) == 0.0


def test_calculate_commit_frequency_with_commits_returns_average():
    assert calculate_commit_frequency(12, 3) == 4.0


def test_analyze_repository_handles_zero_commits_and_pull_requests():
    """A fresh repository with no commits or PRs should complete analysis."""
    responses = {
        "/repos/example/fresh-repo": {},
        "/repos/example/fresh-repo/commits?per_page=1": [],
        "/repos/example/fresh-repo/pulls?state=closed&per_page=30": [],
        "/repos/example/fresh-repo/pulls?state=open&per_page=1": [],
        "/repos/example/fresh-repo/contributors?per_page=100": [],
        "/search/issues?q=repo:example/fresh-repo+type:issue+state:closed&per_page=1": {
            "total_count": 0
        },
        "/repos/example/fresh-repo/issues/comments?per_page=50&sort=created&direction=desc": [],
    }

    def fake_get(path, token=None):
        return responses[path]

    with patch("apps.project_health.services._github_get", side_effect=fake_get):
        result = analyze_repository("https://github.com/example/fresh-repo")

    assert result["closed_prs"] == 0
    assert result["open_prs"] == 0
    assert result["last_commit_days_ago"] is None
    assert result["health_score"] >= 0
