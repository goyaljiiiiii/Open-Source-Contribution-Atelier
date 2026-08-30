"""
DRF serializers for the Flashcards & Spaced Repetition app.
"""

from rest_framework import serializers

from .models import (
    Deck,
    DeckShare,
    Flashcard,
    ReviewLog,
    ReviewSchedule,
    StudySession,
)


class DeckSerializer(serializers.ModelSerializer):
    card_count = serializers.IntegerField(read_only=True)
    clone_count = serializers.IntegerField(read_only=True)
    is_due = serializers.SerializerMethodField()
    due_count = serializers.SerializerMethodField()

    class Meta:
        model = Deck
        fields = [
            "id",
            "title",
            "description",
            "deck_type",
            "source_lesson",
            "source_skill_slug",
            "color",
            "icon_emoji",
            "is_public",
            "clone_count",
            "card_count",
            "is_due",
            "due_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "card_count",
            "clone_count",
            "created_at",
            "updated_at",
        ]

    def get_is_due(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ReviewSchedule.objects.filter(
            user=request.user,
            flashcard__deck=obj,
            next_review__lte=timezone.now(),
        ).exists()

    def get_due_count(self, obj):
        request = self.context.get("request")
        if not request.user or not request.user.is_authenticated:
            return 0
        return ReviewSchedule.objects.filter(
            user=request.user,
            flashcard__deck=obj,
            next_review__lte=timezone.now(),
        ).count()


class FlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flashcard
        fields = [
            "id",
            "front",
            "back",
            "hint",
            "difficulty",
            "tags",
            "media_url",
            "order",
            "is_suspended",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class FlashcardCreateBulkSerializer(serializers.Serializer):
    """Bulk-create flashcards in a deck."""
    cards = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=100,
    )

    def validate_cards(self, value):
        for i, card in enumerate(value):
            if "front" not in card:
                raise serializers.ValidationError(
                    f"Card at index {i} missing 'front' field."
                )
            if "back" not in card:
                raise serializers.ValidationError(
                    f"Card at index {i} missing 'back' field."
                )
        return value


class ReviewScheduleSerializer(serializers.ModelSerializer):
    card = FlashcardSerializer(source="flashcard", read_only=True)
    accuracy_pct = serializers.FloatField(read_only=True)
    is_due = serializers.BooleanField(read_only=True)
    maturity_label = serializers.CharField(read_only=True)

    class Meta:
        model = ReviewSchedule
        fields = [
            "id",
            "card",
            "easiness_factor",
            "interval_days",
            "repetition",
            "next_review",
            "last_reviewed",
            "total_reviews",
            "correct_reviews",
            "streak",
            "is_new",
            "accuracy_pct",
            "is_due",
            "maturity_label",
        ]


class ReviewLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewLog
        fields = [
            "id",
            "flashcard",
            "rating",
            "prev_easiness",
            "prev_interval",
            "prev_repetition",
            "new_easiness",
            "new_interval",
            "new_repetition",
            "response_time_ms",
            "reviewed_at",
        ]


class ReviewSubmitSerializer(serializers.Serializer):
    card_id = serializers.IntegerField()
    quality = serializers.IntegerField(min_value=0, max_value=4)
    response_time_ms = serializers.IntegerField(
        default=0, min_value=0,
    )


class DeckStatsSerializer(serializers.Serializer):
    total_cards = serializers.IntegerField()
    new_cards = serializers.IntegerField()
    learning = serializers.IntegerField()
    young = serializers.IntegerField()
    mature = serializers.IntegerField()
    due_now = serializers.IntegerField()
    avg_easiness = serializers.FloatField()
    avg_accuracy = serializers.FloatField()
    total_reviews = serializers.IntegerField()


class StudyStatsSerializer(serializers.Serializer):
    total_decks = serializers.IntegerField()
    total_cards = serializers.IntegerField()
    due_now = serializers.IntegerField()
    today_reviews = serializers.IntegerField()
    total_sessions = serializers.IntegerField()
    total_cards_reviewed = serializers.IntegerField()
    total_xp = serializers.IntegerField()


class StudySessionSerializer(serializers.ModelSerializer):
    accuracy_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = StudySession
        fields = [
            "id",
            "deck",
            "session_type",
            "cards_reviewed",
            "cards_correct",
            "duration_seconds",
            "accuracy_pct",
            "xp_earned",
            "started_at",
            "ended_at",
        ]


class DeckCloneSerializer(serializers.Serializer):
    deck_id = serializers.IntegerField()


class ReviewResponseSerializer(serializers.Serializer):
    log_id = serializers.IntegerField()
    quality = serializers.IntegerField()
    is_correct = serializers.BooleanField()
    new_easiness = serializers.FloatField()
    new_interval_days = serializers.IntegerField()
    next_review = serializers.DateTimeField()
    streak = serializers.IntegerField()
    maturity = serializers.CharField()
    xp_earned = serializers.IntegerField()
