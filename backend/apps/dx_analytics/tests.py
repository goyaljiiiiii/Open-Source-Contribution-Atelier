import pytest
from django.apps import apps
from apps.dx_analytics.models import DeveloperExperienceMetric, DXSnapshot
from apps.dx_analytics.services import DXScoreService
from apps.dx_analytics.apps import DxAnalyticsConfig


@pytest.mark.django_db
def test_dx_analytics_app_installed():
    assert apps.is_installed("apps.dx_analytics")
    assert DxAnalyticsConfig.name == "apps.dx_analytics"


@pytest.mark.django_db
def test_dx_score_service_perfect():
    # Should be 100 when no failures or slow times
    DeveloperExperienceMetric.objects.create(
        workflow_name="fast_test", execution_time_ms=5000, success=True
    )
    score = DXScoreService.calculate_current_score()
    assert score == 100


@pytest.mark.django_db
def test_dx_score_service_failure_penalty():
    DeveloperExperienceMetric.objects.create(
        workflow_name="failing_test", execution_time_ms=5000, success=False
    )
    score = DXScoreService.calculate_current_score()
    assert score < 100


@pytest.mark.django_db
def test_dx_models_str_repr():
    metric = DeveloperExperienceMetric.objects.create(
        workflow_name="ci_test", execution_time_ms=12000, success=True
    )
    snapshot = DXSnapshot.objects.create(score=85.5)

    assert metric.workflow_name == "ci_test"
    assert snapshot.score == 85.5
