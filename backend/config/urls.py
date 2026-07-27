from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from graphene_django.views import GraphQLView

from apps.billing.views import CheckoutSessionView
from apps.billing.webhooks import stripe_webhook
from apps.core.versioning import VersionedAPIRouter
from apps.dashboard.views import LeaderboardView

from .health_view import health_view
from .version_view import api_versions_view, version_view

# ── API v1 Endpoint Definitions ────────────────────────────────────────────────
api_v1_patterns = [
    # ── Discovery & Info ───────────────────────────────────────────────────────
    path("version/", version_view, name="version"),
    path("versions/", api_versions_view, name="api-versions"),
    # ── Core Features ─────────────────────────────────────────────────────────
    path("admin/", include("apps.monitoring.urls")),
    path("monitoring/", include("apps.monitoring.urls")),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
    path("auth/", include("apps.accounts.urls")),
    path("users/", include("apps.accounts.user_urls")),
    path("content/", include("apps.content.urls")),
    path("billing/", include("apps.billing.urls")),
    path("progress/", include("apps.progress.urls")),
    path("localization/", include("apps.localization.urls")),
    path("challenges/", include("apps.challenges.urls")),
    path("sandbox/", include("apps.sandbox.urls")),
    path("gamification/", include("apps.gamification.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("predictions/", include("apps.predictions.urls")),
    path("search/", include("apps.search.urls")),
    path("notes/", include("apps.notes.urls")),
    path("recommendations/", include("apps.recommendations.urls")),
    path("uploads/", include("apps.uploads.urls")),
    path("rbac/", include("apps.rbac.urls")),
    path("moderation/", include("apps.moderation.urls")),
    path("portfolio/", include("apps.portfolio.urls")),
    path("organizations/", include("apps.organizations.urls")),
    path("accessibility/", include("apps.accessibility.urls")),
    path("issues/", include("apps.issues.urls")),
    path("project-health/", include("apps.project_health.urls")),
    path("security/", include("apps.security.urls")),
    path("plugins/", include("apps.plugins.urls")),
    path("burnout-detection/", include("apps.burnout_detection.urls")),
    path("advanced-search/", include("apps.advanced_search.urls")),
    path("feature-requests/", include("apps.feature_requests.urls")),
    path("issue-categorization/", include("apps.issue_categorization.urls")),
    path("issue-quality-ci/", include("apps.issue_quality_ci.urls")),
    path("issue-routing/", include("apps.issue_routing.urls")),
    path("onboarding/", include("apps.onboarding.urls")),
    path("pr-review-bot/", include("apps.pr_review_bot.urls")),
    path("skills-matching/", include("apps.skills_matching.urls")),
    path("experiments/", include("apps.experiments.urls")),
    path("feed/", include("apps.feed.urls")),
    path("dx-testing/", include("apps.dx_testing.urls")),
    path("issue-quality/", include("apps.issue_quality.urls")),
    path("ml-triage/", include("apps.ml_triage.urls")),
    path("ai/tutor/", include("apps.ai_tutor.urls")),
    path("graphql/", include("apps.graphql_gateway.urls")),
    path("graphql/legacy/", csrf_exempt(GraphQLView.as_view(graphiql=True))),
    # ── OpenAPI & Docs ─────────────────────────────────────────────────────────
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

urlpatterns = [
    # ── Django Admin & External Webhooks ──────────────────────────────────────
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("create-checkout-session/", CheckoutSessionView.as_view()),
    path("webhook/", stripe_webhook),
    # ── Health Checks ──────────────────────────────────────────────────────────
    path("health/", include("apps.health.urls")),
    path("health/legacy/", health_view, name="health"),
    # ── Version Discovery (root /api/versions/) ─────────────────────────────
    path("api/versions/", api_versions_view, name="root-api-versions"),
    # ── Stable Versioned API (/api/v1/) ───────────────────────────────────────
    path("api/v1/", include(api_v1_patterns)),
    # ── Unversioned API Fallback (/api/) ───────────────────────────────────────
    path("api/", include(api_v1_patterns)),
]

if settings.DEBUG:
    from apps.feature_flags.debug_view import feature_flags_debug_view

    urlpatterns += [
        path("api/v1/feature-flags/", include("apps.feature_flags.urls")),
        path("api/feature-flags/", include("apps.feature_flags.urls")),
    ]
