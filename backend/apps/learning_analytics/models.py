"""
Learning Analytics & Insights models.

Tracks user learning patterns, generates insights, and computes analytics
metrics for the learning dashboard.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class LearningSession(models.Model):
    """Records a discrete learning session (lesson opened → closed)."""

    class ActivityType(models.TextChoices):
        LESSON = "lesson", "Lesson"
        EXERCISE = "exercise", "Exercise"
        QUIZ = "quiz", "Quiz"
        SANDBOX = "sandbox", "Sandbox"
        PEER_REVIEW = "peer_review", "Peer Review"
        CHALLENGE = "challenge", "Challenge"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_sessions",
    )
    activity_type = models.CharField(
        max_length=20,
        choices=ActivityType.choices,
        db_index=True,
    )
    activity_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="FK id of the related Lesson/Exercise/etc.",
    )
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Elapsed seconds for the session.",
    )
    xp_earned = models.IntegerField(default=0)
    score = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Quiz score 0-100 if applicable.",
    )
    completed = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(
                fields=["user", "activity_type"],
                name="idx_ls_user_activity",
            ),
            models.Index(
                fields=["user", "-started_at"],
                name="idx_ls_user_time",
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} — {self.activity_type} "
            f"({self.duration_seconds}s)"
        )

    def end_session(self, **kwargs):
        """Mark the session as ended and compute duration if missing."""
        self.ended_at = kwargs.get("ended_at") or timezone.now()
        if not self.duration_seconds and self.started_at:
            self.duration_seconds = max(
                0,
                int((self.ended_at - self.started_at).total_seconds()),
            )
        for k, v in kwargs.items():
            setattr(self, k, v)
        self.save()


class SkillTag(models.Model):
    """A skill area that learning activities map to (e.g. 'git-basics')."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="children",
    )
    icon_emoji = models.CharField(max_length=10, default="📚")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SessionSkillTag(models.Model):
    """Many-to-many through model linking sessions to skill tags."""

    session = models.ForeignKey(
        LearningSession,
        on_delete=models.CASCADE,
        related_name="skill_tags",
    )
    skill_tag = models.ForeignKey(
        SkillTag,
        on_delete=models.CASCADE,
        related_name="tagged_sessions",
    )
    confidence = models.FloatField(
        default=1.0,
        help_text="0-1 confidence of the tag assignment.",
    )

    class Meta:
        unique_together = ("session", "skill_tag")


class UserSkillProfile(models.Model):
    """Aggregated skill level for a user per skill tag.

    Updated periodically by the ``compute_skill_levels`` management command
    or in real-time when a session ends.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="skill_profiles",
    )
    skill_tag = models.ForeignKey(
        SkillTag,
        on_delete=models.CASCADE,
        related_name="user_profiles",
    )
    level = models.PositiveIntegerField(
        default=0,
        help_text="Computed skill level 0-100.",
    )
    total_sessions = models.PositiveIntegerField(default=0)
    total_xp = models.IntegerField(default=0)
    average_score = models.FloatField(default=0.0)
    last_practiced = models.DateTimeField(null=True, blank=True)
    trend = models.CharField(
        max_length=10,
        choices=[
            ("rising", "Rising"),
            ("stable", "Stable"),
            ("declining", "Declining"),
        ],
        default="stable",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "skill_tag")
        ordering = ["-level"]
        indexes = [
            models.Index(
                fields=["user", "-level"],
                name="idx_usp_user_level",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.skill_tag.slug} " f"Lv.{self.level}"


class LearningInsight(models.Model):
    """A generated insight or recommendation for a user."""

    class InsightType(models.TextChoices):
        STREAK = "streak", "Streak Insight"
        SKILL_GAP = "skill_gap", "Skill Gap"
        MOMENTUM = "momentum", "Momentum Change"
        MILESTONE = "milestone", "Milestone Near"
        WARNING = "warning", "Warning"
        TIP = "tip", "Learning Tip"
        WEEKLY_SUMMARY = "weekly_summary", "Weekly Summary"
        MONTHLY_RECAP = "monthly_recap", "Monthly Recap"

    class Priority(models.IntegerChoices):
        LOW = 0, "Low"
        MEDIUM = 1, "Medium"
        HIGH = 2, "High"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_insights",
    )
    insight_type = models.CharField(
        max_length=20,
        choices=InsightType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    priority = models.IntegerField(
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    action_url = models.URLField(
        blank=True,
        help_text="Deep-link the user to the relevant page.",
    )
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extra payload for the frontend to render.",
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-priority", "-generated_at"]
        indexes = [
            models.Index(
                fields=["user", "is_read"],
                name="idx_li_user_read",
            ),
            models.Index(
                fields=["user", "insight_type"],
                name="idx_li_user_type",
            ),
        ]

    def __str__(self):
        return f"[{self.insight_type}] {self.title}"

    @property
    def is_expired(self):
        return self.expires_at and timezone.now() > self.expires_at


class DailyLearningMetric(models.Model):
    """Materialised daily rollup of learning metrics per user.

    One row per (user, date).  Updated by the ``compute_daily_metrics``
    management command or synchronously on each session end.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_learning_metrics",
    )
    date = models.DateField(db_index=True)
    total_minutes = models.PositiveIntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    exercises_completed = models.PositiveIntegerField(default=0)
    quizzes_taken = models.PositiveIntegerField(default=0)
    average_quiz_score = models.FloatField(default=0.0)
    xp_earned = models.IntegerField(default=0)
    streak_days = models.PositiveIntegerField(default=0)
    unique_skills_practiced = models.PositiveIntegerField(default=0)
    focus_score = models.FloatField(
        default=0.0,
        help_text="0-1 ratio of focused vs idle time.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "date")
        ordering = ["-date"]
        indexes = [
            models.Index(
                fields=["user", "-date"],
                name="idx_dlm_user_date",
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} — {self.date} "
            f"({self.total_minutes}min, {self.xp_earned}xp)"
        )


class LearningGoal(models.Model):
    """A user-set learning goal with progress tracking."""

    class GoalType(models.TextChoices):
        XP_TARGET = "xp_target", "XP Target"
        LESSON_COUNT = "lesson_count", "Lesson Count"
        STREAK_TARGET = "streak_target", "Streak Target"
        SKILL_LEVEL = "skill_level", "Skill Level"
        QUIZ_AVERAGE = "quiz_average", "Quiz Average"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learning_goals",
    )
    goal_type = models.CharField(
        max_length=20,
        choices=GoalType.choices,
    )
    title = models.CharField(max_length=255)
    target_value = models.PositiveIntegerField(
        help_text="Numeric target (e.g. 1000 XP, 10 lessons).",
    )
    current_value = models.PositiveIntegerField(default=0)
    skill_tag = models.ForeignKey(
        SkillTag,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_goals",
    )
    start_date = models.DateField(default=timezone.now)
    deadline = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "is_completed"],
                name="idx_lg_user_completed",
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} — {self.title} "
            f"({self.current_value}/{self.target_value})"
        )

    @property
    def progress_pct(self):
        if self.target_value == 0:
            return 0
        return min(100, int(self.current_value / self.target_value * 100))

    @property
    def is_overdue(self):
        return (
            self.deadline is not None
            and not self.is_completed
            and timezone.now().date() > self.deadline
        )
