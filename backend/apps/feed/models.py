from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class FeedEvent(models.Model):
    event_type = models.CharField(max_length=50, db_index=True)
    actor = models.ForeignKey(User, on_delete=models.CASCADE)
    target_id = models.CharField(max_length=255, blank=True)
    target_title = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class FeedPost(models.Model):
    POST_TYPES = [
        ("question", "Question"),
        ("discussion", "Discussion"),
        ("share", "Share"),
    ]

    title = models.CharField(max_length=255)
    body = models.TextField()
    post_type = models.CharField(
        max_length=20, choices=POST_TYPES, default="discussion", db_index=True
    )
    author = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="feed_posts"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["post_type", "-created_at"], name="idx_feedpost_type_time"
            ),
        ]

    def __str__(self):
        return f"{self.title} ({self.post_type}) by {self.author.username}"
