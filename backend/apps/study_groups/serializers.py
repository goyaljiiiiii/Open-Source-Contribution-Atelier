"""
DRF serializers for the Study Groups app.
"""

from rest_framework import serializers

from .models import (
    GroupActivity,
    GroupChallenge,
    GroupChallengeParticipant,
    GroupGoal,
    GroupInvite,
    GroupMessage,
    GroupMembership,
    GroupResource,
    StudyGroup,
)


class StudyGroupSerializer(serializers.ModelSerializer):
    is_member = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    owner_username = serializers.CharField(
        source="owner.username", read_only=True,
    )

    class Meta:
        model = StudyGroup
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "visibility",
            "category",
            "owner",
            "owner_username",
            "cover_image_url",
            "icon_emoji",
            "color",
            "max_members",
            "member_count",
            "total_xp",
            "streak_days",
            "weekly_goal_minutes",
            "is_archived",
            "is_member",
            "my_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "member_count",
            "total_xp",
            "streak_days",
            "created_at",
            "updated_at",
        ]

    def get_is_member(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.is_member(request.user)

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return obj.get_member_role(request.user)


class StudyGroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyGroup
        fields = [
            "name",
            "slug",
            "description",
            "visibility",
            "category",
            "cover_image_url",
            "icon_emoji",
            "color",
            "max_members",
            "weekly_goal_minutes",
        ]


class GroupMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )

    class Meta:
        model = GroupMembership
        fields = [
            "id",
            "user",
            "username",
            "role",
            "status",
            "nickname",
            "joined_at",
            "last_active",
            "total_minutes_contributed",
            "total_xp_contributed",
            "lessons_completed",
            "quizzes_passed",
        ]
        read_only_fields = [
            "id",
            "user",
            "joined_at",
            "total_minutes_contributed",
            "total_xp_contributed",
            "lessons_completed",
            "quizzes_passed",
        ]


class GroupResourceSerializer(serializers.ModelSerializer):
    shared_by_username = serializers.CharField(
        source="shared_by.username", read_only=True,
    )

    class Meta:
        model = GroupResource
        fields = [
            "id",
            "resource_type",
            "title",
            "description",
            "url",
            "flashcard_deck",
            "metadata",
            "upvotes",
            "shared_by",
            "shared_by_username",
            "created_at",
        ]
        read_only_fields = ["id", "upvotes", "created_at"]


class GroupActivitySerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )

    class Meta:
        model = GroupActivity
        fields = [
            "id",
            "activity_type",
            "title",
            "description",
            "xp_value",
            "metadata",
            "user",
            "username",
            "created_at",
        ]


class GroupInviteSerializer(serializers.ModelSerializer):
    invited_by_username = serializers.CharField(
        source="invited_by.username", read_only=True,
    )

    class Meta:
        model = GroupInvite
        fields = [
            "id",
            "invited_user",
            "email",
            "message",
            "status",
            "token",
            "invited_by",
            "invited_by_username",
            "created_at",
            "expires_at",
        ]
        read_only_fields = [
            "id",
            "token",
            "status",
            "invited_by",
            "created_at",
        ]


class GroupChallengeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True,
    )
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = GroupChallenge
        fields = [
            "id",
            "title",
            "description",
            "status",
            "target_value",
            "target_type",
            "xp_reward",
            "start_date",
            "end_date",
            "created_by",
            "created_by_username",
            "participant_count",
            "created_at",
        ]

    def get_participant_count(self, obj):
        return obj.participants.count()


class GroupChallengeParticipantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )
    progress_pct = serializers.IntegerField(read_only=True)

    class Meta:
        model = GroupChallengeParticipant
        fields = [
            "id",
            "user",
            "username",
            "current_value",
            "completed",
            "completed_at",
            "xp_earned",
            "progress_pct",
            "joined_at",
        ]


class GroupGoalSerializer(serializers.ModelSerializer):
    progress_pct = serializers.IntegerField(read_only=True)

    class Meta:
        model = GroupGoal
        fields = [
            "id",
            "goal_type",
            "title",
            "target_value",
            "current_value",
            "is_completed",
            "deadline",
            "xp_reward",
            "progress_pct",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "current_value",
            "is_completed",
            "created_at",
        ]


class GroupMessageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username", read_only=True,
    )
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = GroupMessage
        fields = [
            "id",
            "content",
            "is_pinned",
            "parent",
            "upvotes",
            "user",
            "username",
            "reply_count",
            "created_at",
        ]
        read_only_fields = ["id", "upvotes", "created_at"]

    def get_reply_count(self, obj):
        if obj.parent is not None:
            return 0
        return obj.replies.count()


class GroupStatsSerializer(serializers.Serializer):
    member_count = serializers.IntegerField()
    active_this_week = serializers.IntegerField()
    total_xp = serializers.IntegerField()
    weekly_xp = serializers.IntegerField()
    streak_days = serializers.IntegerField()
    lessons_completed = serializers.IntegerField()
    leaderboard = serializers.ListField()
    active_challenges = serializers.IntegerField()
    top_resource = serializers.DictField(allow_null=True)


class GroupLeaderboardSerializer(serializers.Serializer):
    period = serializers.CharField()
    entries = serializers.ListField()


class GroupDiscoverSerializer(serializers.Serializer):
    groups = serializers.ListField()
    total = serializers.IntegerField()


class InviteCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    email = serializers.EmailField(required=False)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("user_id") and not attrs.get("email"):
            raise serializers.ValidationError(
                "Either user_id or email is required."
            )
        return attrs


class InviteAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)


class PlatformGroupStatsSerializer(serializers.Serializer):
    total_groups = serializers.IntegerField()
    total_members = serializers.IntegerField()
    total_xp = serializers.IntegerField()
    public_groups = serializers.IntegerField()
    private_groups = serializers.IntegerField()
    invite_only = serializers.IntegerField()
    top_categories = serializers.ListField()
