from rest_framework import serializers

from .models import FeedEvent, FeedPost


class FeedEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedEvent
        fields = "__all__"


class FeedPostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = FeedPost
        fields = [
            "id",
            "title",
            "body",
            "post_type",
            "author",
            "author_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author", "created_at", "updated_at"]
