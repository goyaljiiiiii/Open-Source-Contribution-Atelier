from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.db import connections

from config.db_router import PrimaryReplicaRouter


VIEW_REPRESENTATIVE_MODELS = {
    "LeaderboardView": "dashboard.Issue",
    "ContributorDashboardView": "dashboard.PullRequest",
    "CommunityStatsView": "progress.DailyActivity",
    "AuditEventListView": "audit.AuditEvent",
    "ModeratorAnalyticsView": "progress.QuizAttempt",
}


class TestAnalyticsReadReplicaRouter:
    @pytest.fixture
    def router(self):
        with patch("sys.argv", ["manage.py", "runserver"]):
            return PrimaryReplicaRouter()

    @pytest.mark.parametrize("view_name,model_label", VIEW_REPRESENTATIVE_MODELS.items())
    def test_each_analytics_view_routes_to_read_replica(
        self, router, view_name, model_label
    ):
        app_label, model_name = model_label.split(".")
        model = MagicMock()
        model._meta.app_label = app_label
        model._meta.model_name = model_name.lower()

        mock_connection = MagicMock()
        mock_connection.connection = object()

        with (
            patch.object(settings, "DATABASES", {"default": {}, "read_replica": {}}),
            patch.object(router, "replicas", []),
            patch.object(connections, "__getitem__", return_value=mock_connection),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=False),
            ),
        ):
            assert router.db_for_read(model) == "read_replica"

    @pytest.mark.parametrize(
        "model_label",
        [
            "auth.User",
            "dashboard.Issue",
            "dashboard.PullRequest",
            "progress.LessonProgress",
            "challenges.ChallengeCompletion",
            "progress.CodeSubmission",
            "progress.DailyActivity",
            "progress.QuizAttempt",
            "progress.UserBadge",
            "progress.StreakProfile",
            "progress.WeeklyGoal",
            "progress.Season",
            "progress.TrackMilestone",
            "progress.UserMilestoneCompletion",
            "progress.ExerciseAttempt",
            "progress.XPEvent",
            "progress.Badge",
            "content.Lesson",
            "audit.AuditEvent",
        ],
    )
    def test_analytics_models_use_read_replica_when_configured(
        self, router, model_label
    ):
        app_label, model_name = model_label.split(".")
        model = MagicMock()
        model._meta.app_label = app_label
        model._meta.model_name = model_name.lower()

        mock_connection = MagicMock()
        mock_connection.connection = object()

        with (
            patch.object(settings, "DATABASES", {"default": {}, "read_replica": {}}),
            patch.object(router, "replicas", []),
            patch.object(connections, "__getitem__", return_value=mock_connection),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=False),
            ),
        ):
            assert router.db_for_read(model) == "read_replica"

    def test_non_analytics_model_keeps_existing_default(self, router):
        model = MagicMock()
        model._meta.app_label = "accounts"
        model._meta.model_name = "profile"

        with (
            patch.object(settings, "DATABASES", {"default": {}}),
            patch.object(router, "replicas", []),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=False),
            ),
        ):
            assert router.db_for_read(model) == "default"

    def test_analytics_reads_fall_back_when_replica_is_not_configured(self, router):
        model = MagicMock()
        model._meta.app_label = "audit"
        model._meta.model_name = "auditevent"

        with (
            patch.object(settings, "DATABASES", {"default": {}}),
            patch.object(router, "replicas", []),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=False),
            ),
        ):
            assert router.db_for_read(model) == "default"

    def test_analytics_replica_health_failure_falls_back_to_default(self, router):
        model = MagicMock()
        model._meta.app_label = "dashboard"
        model._meta.model_name = "issue"

        mock_connection = MagicMock()
        mock_connection.connection = None
        from django.db.utils import OperationalError

        mock_connection.ensure_connection.side_effect = OperationalError("offline")

        with (
            patch.object(settings, "DATABASES", {"default": {}, "read_replica": {}}),
            patch.object(router, "replicas", []),
            patch.object(connections, "__getitem__", return_value=mock_connection),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=False),
            ),
        ):
            assert router.db_for_read(model) == "default"

    def test_writes_always_use_default(self, router):
        model = MagicMock()
        assert router.db_for_write(model) == "default"

    def test_analytics_reads_stay_on_default_inside_atomic_block(self, router):
        model = MagicMock()
        model._meta.app_label = "progress"
        model._meta.model_name = "lessonprogress"

        with (
            patch.object(settings, "DATABASES", {"default": {}, "read_replica": {}}),
            patch.object(router, "replicas", []),
            patch(
                "config.db_router.transaction.get_connection",
                return_value=MagicMock(in_atomic_block=True),
            ),
        ):
            assert router.db_for_read(model) == "default"
