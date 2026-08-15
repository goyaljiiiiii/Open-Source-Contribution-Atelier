from rest_framework import serializers

from .models import Comment, FeatureRequest, RoadmapMilestone, StatusHistory, Vote


class FeatureRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeatureRequest
        fields = "__all__"


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = "__all__"


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = "__all__"


class StatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusHistory
        fields = "__all__"


class RoadmapMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoadmapMilestone
        fields = "__all__"
