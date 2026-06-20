from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Lesson(models.Model):
    difficulty = models.CharField(max_length=32)
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    summary = models.TextField()
    content = models.TextField()
    learning_objectives = models.JSONField(default=list, blank=True)
    tips = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=100, default='general')
    estimated_minutes = models.PositiveIntegerField(
        default=15,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(120),
        ],
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class Exercise(models.Model):
    lesson = models.ForeignKey(Lesson, related_name="exercises", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    prompt = models.TextField()
    expected_command = models.CharField(max_length=255)
    explanation = models.TextField(blank=True)
    points = models.PositiveIntegerField(default=10)


# ─── NAYA CODE YAHAN SE SHURU ──────────────────────────────────────────────────

class ActiveCommentManager(models.Manager):
    """Custom manager to only return comments that are not deleted."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    # Link comment to a Lesson. Agar platform par general comments hain, toh is line ko hata dena.
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="comments", null=True, blank=True)
    
    content = models.TextField(help_text="The main body of the comment")
    
    # 🔥 The Soft Delete Flag
    is_deleted = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = models.Manager() # Default manager
    active_objects = ActiveCommentManager() # Manager for filtering out deleted comments

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_deleted"], name="idx_comment_is_deleted"),
        ]

    def soft_delete(self):
        self.is_deleted = True
        self.save(update_fields=["is_deleted"])

    def restore(self):
        self.is_deleted = False
        self.save(update_fields=["is_deleted"])

    def __str__(self):
        status = "[DELETED] " if self.is_deleted else ""
        return f"{status}Comment by {self.user.username}"