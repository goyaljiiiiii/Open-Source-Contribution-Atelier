"""
DRF serializers for the Learning Analytics app.
"""

from rest_framework import serializers

from .models import (
    DailyLearningMetric,
    LearningGoal,
    LearningInsight,
    LearningSession,
    SessionSkillTag,
    SkillTag,
    UserSkillProfile,
)


class SkillTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillTag
        fields = ["id", "name", "slug", "description", "icon_emoji"]


class SessionSkillTagSerializer(serializers.ModelSerializer):
    skill_tag = SkillTagSerializer(read_only=True)

    class Meta:
        model = SessionSkillTag
        fields = ["skill_tag", "confidence"]


class LearningSessionSerializer(serializers.ModelSerializer):
    skill_tags = SessionSkillTagSerializer(many=True, read_only=True)
    duration_display = serializers.SerializerMethodField()

    class Meta:
        model = LearningSession
        fields = [
            "id",
            "activity_type",
            "activity_id",
            "started_at",
            "ended_at",
            "duration_seconds",
            "duration_display",
            "xp_earned",
            "score",
            "completed",
            "metadata",
            "skill_tags",
        ]

    def get_duration_display(self, obj):
        mins, secs = divmod(obj.duration_seconds, 60)
        hours, mins = divmod(mins, 60)
        if hours:
            return f"{hours}h {mins}m"
        return f"{mins}m {secs}s"


class LearningSessionCreateSerializer(serializers.Serializer):
    activity_type = serializers.ChoiceField(
        choices=LearningSession.ActivityType.choices,
    )
    activity_id = serializers.IntegerField(required=False, allow_null=True)
    xp_earned = serializers.IntegerField(default=0)
    score = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        max_value=100,
    )
    completed = serializers.BooleanField(default=True)
    skill_slugs = serializers.ListField(
        child=serializers.SlugField(),
        required=False,
        default=[],
    )
    metadata = serializers.DictField(default=dict)


class UserSkillProfileSerializer(serializers.ModelSerializer):
    skill_tag = SkillTagSerializer(read_only=True)
    skill_tag_slug = serializers.SlugField(
        source="skill_tag.slug",
        read_only=True,
    )

    class Meta:
        model = UserSkillProfile
        fields = [
            "id",
            "skill_tag",
            "skill_tag_slug",
            "level",
            "total_sessions",
            "total_xp",
            "average_score",
            "last_practiced",
            "trend",
        ]


class LearningInsightSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = LearningInsight
        fields = [
            "id",
            "insight_type",
            "title",
            "body",
            "priority",
            "action_url",
            "is_read",
            "is_dismissed",
            "data",
            "generated_at",
            "expires_at",
            "is_expired",
        ]
        read_only_fields = [
            "id",
            "generated_at",
            "is_expired",
        ]


class DailyLearningMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLearningMetric
        fields = [
            "id",
            "date",
            "total_minutes",
            "lessons_completed",
            "exercises_completed",
            "quizzes_taken",
            "average_quiz_score",
            "xp_earned",
            "streak_days",
            "unique_skills_practiced",
            "focus_score",
        ]


class LearningGoalSerializer(serializers.ModelSerializer):
    progress_pct = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    skill_tag = SkillTagSerializer(read_only=True)
    skill_tag_slug = serializers.SlugField(
        source="skill_tag.slug",
        read_only=True,
        required=False,
    )

    class Meta:
        model = LearningGoal
        fields = [
            "id",
            "goal_type",
            "title",
            "target_value",
            "current_value",
            "skill_tag",
            "skill_tag_slug",
            "start_date",
            "deadline",
            "is_completed",
            "is_archived",
            "progress_pct",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_completed",
            "created_at",
            "updated_at",
        ]


class LearningGoalCreateSerializer(serializers.ModelSerializer):
    skill_slug = serializers.SlugField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = LearningGoal
        fields = [
            "goal_type",
            "title",
            "target_value",
            "skill_slug",
            "deadline",
        ]

    def validate(self, attrs):
        if attrs["goal_type"] == "skill_level" and not attrs.get("skill_slug"):
            raise serializers.ValidationError(
                {"skill_slug": "Required for skill_level goals."}
            )
        return attrs

    def create(self, validated_data):
        skill_slug = validated_data.pop("skill_slug", None)
        user = self.context["request"].user

        skill_tag = None
        if skill_slug:
            try:
                skill_tag = SkillTag.objects.get(slug=skill_slug)
            except SkillTag.DoesNotExist:
                pass

        goal = LearningGoal.objects.create(
            user=user,
            skill_tag=skill_tag,
            **validated_data,
        )
        return goal


class AnalyticsDashboardSerializer(serializers.Serializer):
    period_days = serializers.IntegerField()
    summary = serializers.DictField()
    charts = serializers.DictField()
    activity_breakdown = serializers.DictField()
    skill_levels = serializers.ListField()
    heatmap = serializers.ListField()
    active_goals = serializers.ListField()


class WeeklySummarySerializer(serializers.Serializer):
    period = serializers.CharField()
    summary = serializers.DictField()
    best_day = serializers.DictField(allow_null=True)
    skill_highlights = serializers.DictField()
    recommendations = serializers.ListField()


class MonthlyRecapSerializer(serializers.Serializer):
    period = serializers.CharField()
    this_month = serializers.DictField()
    last_month = serializers.DictField()
    growth = serializers.DictField()


class VelocitySerializer(serializers.Serializer):
    minutes_per_day = serializers.FloatField()
    xp_per_day = serializers.FloatField()
    sessions_per_day = serializers.FloatField()


class InsightDismissSerializer(serializers.Serializer):
    insight_id = serializers.IntegerField()


class InsightBulkReadSerializer(serializers.Serializer):
    insight_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
