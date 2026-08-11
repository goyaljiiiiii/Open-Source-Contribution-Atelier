import pytest
from rest_framework.test import APIClient
from rest_framework import status


@pytest.mark.django_db
class TestPRImpactAnalysisValidation:
    """Test input validation for PRImpactAnalysisViewSet.create endpoint."""

    def setup_method(self):
        self.client = APIClient()
        self.url = "/api/pr-review-bot/impact-analysis/"

    def test_missing_pr_number_returns_400(self):
        res = self.client.post(self.url, {}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "pr_number" in res.data.get("error", "").lower()

    def test_non_integer_pr_number_returns_400(self):
        res = self.client.post(
            self.url, {"pr_number": "invalid_string"}, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "integer" in res.data.get("error", "").lower()

    def test_null_pr_number_returns_400(self):
        res = self.client.post(self.url, {"pr_number": None}, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_float_pr_number_string_returns_400(self):
        res = self.client.post(
            self.url, {"pr_number": "12.5"}, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "integer" in res.data.get("error", "").lower()

    def test_valid_integer_pr_number_does_not_return_400(self):
        """A valid integer pr_number should pass validation (may fail downstream but not with 400 validation error)."""
        res = self.client.post(
            self.url,
            {"pr_number": 123, "changed_files": []},
            format="json",
        )
        # Should not be a 400 validation error for pr_number
        assert res.status_code != status.HTTP_400_BAD_REQUEST or "pr_number" not in res.data.get("error", "")
