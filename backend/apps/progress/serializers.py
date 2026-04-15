from rest_framework import serializers

from .models import Badge, LessonProgress


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = "__all__"


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_slug = serializers.ReadOnlyField(source="lesson.slug")

    class Meta:
        model = LessonProgress
        fields = ["id", "user", "lesson", "lesson_slug", "completed", "score", "updated_at"]

