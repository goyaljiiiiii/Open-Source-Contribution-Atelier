from django.core.validators import MaxValueValidator, MinValueValidator
from rest_framework import serializers

from apps.ml_triage.models import (
    Comment,
    Issue,
    IssuePrediction,
    Reaction,
    TrainingData,
)


class IssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Issue
        fields = "__all__"


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = "__all__"


class ReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reaction
        fields = "__all__"


class TrainingDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingData
        fields = "__all__"


class IssuePredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssuePrediction
        fields = "__all__"


class MLTriageSettingsSerializer(serializers.Serializer):
    """Validate ML triage confidence settings before they reach inference."""

    threshold = serializers.FloatField(
        validators=[
            MinValueValidator(0.0, message="Threshold must be at least 0.0."),
            MaxValueValidator(1.0, message="Threshold must be at most 1.0."),
        ]
    )
