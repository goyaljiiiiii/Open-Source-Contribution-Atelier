from rest_framework import serializers

from .models import (
    AutoFixPR,
    ProjectDependency,
    VulnerabilityItem,
    VulnerabilityReport,
    VulnerabilitySuppression,
)


class VulnerabilityItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VulnerabilityItem
        fields = [
            "id",
            "report",
            "cve_id",
            "package_name",
            "installed_version",
            "fixed_version",
            "severity",
            "ecosystem",
            "title",
            "description",
            "status",
            "suppressed_until",
            "suppression_reason",
            "created_at",
        ]


class VulnerabilityReportSerializer(serializers.ModelSerializer):
    items = VulnerabilityItemSerializer(many=True, read_only=True)

    class Meta:
        model = VulnerabilityReport
        fields = [
            "id",
            "scan_date",
            "commit_sha",
            "branch",
            "ecosystem",
            "total_vulnerabilities",
            "critical_count",
            "high_count",
            "medium_count",
            "low_count",
            "summary_json",
            "items",
            "created_at",
        ]


class VulnerabilitySuppressionSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = VulnerabilitySuppression
        fields = [
            "id",
            "cve_id",
            "package_name",
            "reason",
            "expires_at",
            "is_active",
            "created_at",
        ]


class AutoFixPRSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutoFixPR
        fields = [
            "id",
            "pr_number",
            "pr_url",
            "status",
            "packages_updated",
            "created_at",
        ]


class ProjectDependencySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectDependency
        fields = [
            "id",
            "package_name",
            "ecosystem",
            "current_version",
            "latest_version",
            "days_vulnerable",
            "decay_rate",
            "security_score",
            "last_checked_at",
        ]
