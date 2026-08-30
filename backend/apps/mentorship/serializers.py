"""DRF serializers for the Mentorship app."""

from rest_framework import serializers

from .models import (
    MentorProfile,
    MentorshipFeedback,
    MentorshipGoal,
    MentorshipMatch,
    MentorshipMilestone,
    MentorshipRequest,
    MentorshipSession,
)


class MentorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )
    acceptance_rate = serializers.FloatField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = MentorProfile
        fields = [
            "id",
            "user",
            "username",
            "bio",
            "expertise_areas",
            "years_experience",
            "max_mentees",
            "current_mentee_count",
            "availability",
            "preferred_session_duration",
            "languages",
            "timezone_name",
            "total_sessions_mentored",
            "total_hours_mentored",
            "average_rating",
            "rating_count",
            "is_verified",
            "is_active",
            "acceptance_rate",
            "is_full",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "current_mentee_count",
            "total_sessions_mentored",
            "total_hours_mentored",
            "average_rating",
            "rating_count",
            "created_at",
        ]


class MentorshipRequestSerializer(serializers.ModelSerializer):
    mentee_username = serializers.CharField(
        source="mentee.username", read_only=True,
    )
    mentor_username = serializers.CharField(
        source="mentor.username", read_only=True,
    )

    class Meta:
        model = MentorshipRequest
        fields = [
            "id",
            "mentee",
            "mentee_username",
            "mentor",
            "mentor_username",
            "subject",
            "message",
            "skill_wanted",
            "preferred_frequency",
            "status",
            "response_message",
            "created_at",
            "responded_at",
            "expires_at",
        ]
        read_only_fields = [
            "id",
            "mentee",
            "status",
            "response_message",
            "created_at",
            "responded_at",
        ]


class MentorshipMatchSerializer(serializers.ModelSerializer):
    mentor_username = serializers.CharField(
        source="mentor.username", read_only=True,
    )
    mentee_username = serializers.CharField(
        source="mentee.username", read_only=True,
    )
    goal_count = serializers.SerializerMethodField()

    class Meta:
        model = MentorshipMatch
        fields = [
            "id",
            "mentor",
            "mentor_username",
            "mentee",
            "mentee_username",
            "skill_focus",
            "goals",
            "status",
            "start_date",
            "end_date",
            "total_sessions",
            "total_hours",
            "mentor_xp_earned",
            "mentee_xp_earned",
            "notes",
            "goal_count",
            "created_at",
        ]

    def get_goal_count(self, obj):
        return obj.mentorship_goals.count()


class MentorshipSessionSerializer(serializers.ModelSerializer):
    mentor_username = serializers.CharField(
        source="mentor.username", read_only=True,
    )
    mentee_username = serializers.CharField(
        source="mentee.username", read_only=True,
    )

    class Meta:
        model = MentorshipSession
        fields = [
            "id",
            "match",
            "mentor",
            "mentor_username",
            "mentee",
            "mentee_username",
            "title",
            "description",
            "status",
            "scheduled_at",
            "duration_minutes",
            "topics_covered",
            "action_items",
            "mentee_notes",
            "mentor_notes",
            "mentor_rating",
            "mentee_rating",
            "mentor_feedback",
            "mentee_feedback",
            "xp_awarded_mentor",
            "xp_awarded_mentee",
            "started_at",
            "ended_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "xp_awarded_mentor",
            "xp_awarded_mentee",
            "started_at",
            "ended_at",
            "created_at",
        ]


class SessionCompleteSerializer(serializers.Serializer):
    mentor_rating = serializers.IntegerField(
        min_value=1, max_value=5, required=False, allow_null=True,
    )
    mentee_rating = serializers.IntegerField(
        min_value=1, max_value=5, required=False, allow_null=True,
    )
    mentor_feedback = serializers.CharField(
        required=False, allow_blank=True,
    )
    mentee_feedback = serializers.CharField(
        required=False, allow_blank=True,
    )
    topics_covered = serializers.ListField(
        child=serializers.CharField(), required=False, default=list,
    )
    action_items = serializers.ListField(
        child=serializers.CharField(), required=False, default=list,
    )


class MentorshipGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MentorshipGoal
        fields = [
            "id",
            "title",
            "description",
            "status",
            "target_date",
            "achieved_date",
            "progress_pct",
            "created_at",
        ]
        read_only_fields = ["id", "achieved_date", "created_at"]


class MentorshipFeedbackSerializer(serializers.ModelSerializer):
    from_username = serializers.CharField(
        source="from_user.username", read_only=True,
    )
    to_username = serializers.CharField(
        source="to_user.username", read_only=True,
    )

    class Meta:
        model = MentorshipFeedback
        fields = [
            "id",
            "from_user",
            "from_username",
            "to_user",
            "to_username",
            "feedback_type",
            "overall_rating",
            "communication_rating",
            "helpfulness_rating",
            "comment",
            "is_anonymous",
            "created_at",
        ]
        read_only_fields = ["id", "from_user", "created_at"]


class MentorshipMilestoneSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )

    class Meta:
        model = MentorshipMilestone
        fields = [
            "id",
            "title",
            "description",
            "xp_awarded",
            "user",
            "username",
            "achieved_at",
        ]


class FindMentorsSerializer(serializers.Serializer):
    skill = serializers.CharField(required=False, allow_blank=True)
    min_rating = serializers.FloatField(required=False, default=0)
    limit = serializers.IntegerField(required=False, default=10)


class MentorAnalyticsSerializer(serializers.Serializer):
    active_mentees = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    total_hours = serializers.FloatField()
    average_rating = serializers.FloatField()
    rating_count = serializers.IntegerField()
    avg_session_duration = serializers.FloatField()
    sessions_this_month = serializers.IntegerField()
    top_topics = serializers.ListField()
    xp_earned = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()


class MenteeAnalyticsSerializer(serializers.Serializer):
    active_mentors = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    total_hours = serializers.FloatField()
    xp_earned = serializers.IntegerField()
    skills_learned = serializers.ListField()
    sessions_this_month = serializers.IntegerField()


class ProgramStatsSerializer(serializers.Serializer):
    total_mentors = serializers.IntegerField()
    available_mentors = serializers.IntegerField()
    verified_mentors = serializers.IntegerField()
    total_matches = serializers.IntegerField()
    active_matches = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    total_hours = serializers.FloatField()
    total_requests = serializers.IntegerField()
    accepted_requests = serializers.IntegerField()
    pending_requests = serializers.IntegerField()
    average_session_rating = serializers.FloatField()
    top_skills = serializers.ListField()
