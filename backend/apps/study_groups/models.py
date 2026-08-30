"""
Study Groups & Collaborative Learning models.

Enables users to form study groups, share resources, track collective
progress, and compete on group leaderboards.
"""

from __future__ import annotations

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class StudyGroup(models.Model):
    """A collaborative learning group."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public"
        PRIVATE = "private", "Private"
        INVITE_ONLY = "invite_only", "Invite Only"

    class Category(models.TextChoices):
        OPEN_SOURCE = "open_source", "Open Source"
        PYTHON = "python", "Python"
        JAVASCRIPT = "javascript", "JavaScript"
        DEVOPS = "devops", "DevOps"
        DATA_SCIENCE = "data_science", "Data Science"
        GENERAL = "general", "General"

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    visibility = models.CharField(
        max_length=15,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
        db_index=True,
    )
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.GENERAL,
        db_index=True,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_study_groups",
    )
    cover_image_url = models.URLField(
        blank=True,
        help_text="URL to a cover/banner image.",
    )
    icon_emoji = models.CharField(max_length=10, default="📚")
    color = models.CharField(max_length=7, default="#6366f1")
    max_members = models.PositiveIntegerField(
        default=50,
        validators=[MinValueValidator(2), MaxValueValidator(500)],
    )
    member_count = models.PositiveIntegerField(default=1)
    total_xp = models.IntegerField(
        default=0,
        help_text="Aggregate XP earned by all members.",
    )
    streak_days = models.PositiveIntegerField(
        default=0,
        help_text="Consecutive days with at least one member active.",
    )
    weekly_goal_minutes = models.PositiveIntegerField(
        default=60,
        help_text="Group weekly learning goal in minutes.",
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-member_count", "-total_xp"]
        indexes = [
            models.Index(
                fields=["visibility", "-member_count"],
                name="idx_sg_vis_member",
            ),
            models.Index(
                fields=["category", "-total_xp"],
                name="idx_sg_cat_xp",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.member_count} members)"

    @property
    def is_full(self):
        return self.member_count >= self.max_members

    def is_member(self, user) -> bool:
        return GroupMembership.objects.filter(
            group=self, user=user
        ).exists()

    def get_member_role(self, user):
        """Return the user's role in this group, or None."""
        try:
            return GroupMembership.objects.get(
                group=self, user=user
            ).role
        except GroupMembership.DoesNotExist:
            return None


class GroupMembership(models.Model):
    """Membership record linking a user to a study group."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MODERATOR = "moderator", "Moderator"
        MEMBER = "member", "Member"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PENDING = "pending", "Pending"
        BANNED = "banned", "Banned"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_group_memberships",
    )
    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.MEMBER,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    nickname = models.CharField(
        max_length=100,
        blank=True,
        help_text="Display name within this group.",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)
    total_minutes_contributed = models.PositiveIntegerField(default=0)
    total_xp_contributed = models.IntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    quizzes_passed = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "group")
        ordering = ["-total_xp_contributed"]

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.role})"

    @property
    def is_officer(self):
        return self.role in ("owner", "admin", "moderator")


class GroupInvite(models.Model):
    """Invitation to join a study group."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="invites",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_group_invites",
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_group_invites",
        null=True,
        blank=True,
    )
    email = models.EmailField(
        blank=True,
        help_text="For inviting non-registered users.",
    )
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    message = models.TextField(
        blank=True,
        help_text="Personal message with the invite.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        target = self.invited_user or self.email
        return f"Invite to {target} for {self.group.name}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class GroupResource(models.Model):
    """Shared resource within a study group (deck, link, note)."""

    class ResourceType(models.TextChoices):
        DECK = "deck", "Flashcard Deck"
        LINK = "link", "External Link"
        NOTE = "note", "Study Note"
        FILE = "file", "File"

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="resources",
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shared_resources",
    )
    resource_type = models.CharField(
        max_length=10,
        choices=ResourceType.choices,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    flashcard_deck = models.ForeignKey(
        "flashcards.Deck",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="group_shares",
    )
    metadata = models.JSONField(default=dict, blank=True)
    upvotes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-upvotes", "-created_at"]

    def __str__(self):
        return f"[{self.resource_type}] {self.title} in {self.group.name}"


class GroupActivity(models.Model):
    """Tracks activity within a study group for the group feed."""

    class ActivityType(models.TextChoices):
        JOIN = "join", "Member Joined"
        LEAVE = "leave", "Member Left"
        LESSON = "lesson", "Lesson Completed"
        QUIZ = "quiz", "Quiz Passed"
        XP = "xp", "XP Earned"
        RESOURCE = "resource", "Resource Shared"
        MILESTONE = "milestone", "Group Milestone"
        STREAK = "streak", "Streak Achievement"
        CHALLENGE = "challenge", "Challenge Completed"
        NOTE = "note", "Note Posted"

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_activities",
    )
    activity_type = models.CharField(
        max_length=15,
        choices=ActivityType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    xp_value = models.IntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["group", "-created_at"],
                name="idx_ga_group_time",
            ),
            models.Index(
                fields=["group", "activity_type"],
                name="idx_ga_group_type",
            ),
        ]

    def __str__(self):
        return f"{self.activity_type} by {self.user.username} in {self.group.name}"


class GroupChallenge(models.Model):
    """A challenge created within a study group."""

    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="challenges",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_group_challenges",
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.UPCOMING,
        db_index=True,
    )
    target_value = models.PositiveIntegerField(
        default=10,
        help_text="Target count (lessons, XP, minutes, etc.).",
    )
    target_type = models.CharField(
        max_length=20,
        choices=[
            ("lessons", "Lessons"),
            ("xp", "XP"),
            ("minutes", "Study Minutes"),
            ("quiz_score", "Quiz Score"),
            ("streak_days", "Streak Days"),
        ],
        default="lessons",
    )
    xp_reward = models.PositiveIntegerField(default=100)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.title} ({self.group.name})"

    @property
    def is_active(self):
        now = timezone.now()
        return self.start_date <= now <= self.end_date


class GroupChallengeParticipant(models.Model):
    """Tracks a user's progress in a group challenge."""

    challenge = models.ForeignKey(
        GroupChallenge,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_challenge_participations",
    )
    current_value = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    xp_earned = models.PositiveIntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("challenge", "user")
        ordering = ["-current_value"]

    def __str__(self):
        return (
            f"{self.user.username} in {self.challenge.title} "
            f"({self.current_value}/{self.challenge.target_value})"
        )

    @property
    def progress_pct(self):
        if self.challenge.target_value == 0:
            return 0
        return min(
            100,
            int(self.current_value / self.challenge.target_value * 100),
        )


class GroupGoal(models.Model):
    """A collective learning goal for the group."""

    class GoalType(models.TextChoices):
        TOTAL_XP = "total_xp", "Total XP"
        LESSON_COUNT = "lesson_count", "Lesson Count"
        MEMBER_ACTIVE = "member_active", "Active Members"
        WEEKLY_MINUTES = "weekly_minutes", "Weekly Minutes"
        QUIZ_AVERAGE = "quiz_average", "Quiz Average Score"

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="goals",
    )
    goal_type = models.CharField(
        max_length=20,
        choices=GoalType.choices,
    )
    title = models.CharField(max_length=255)
    target_value = models.PositiveIntegerField()
    current_value = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    deadline = models.DateField(null=True, blank=True)
    xp_reward = models.PositiveIntegerField(
        default=200,
        help_text="XP split among members on completion.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.title} ({self.current_value}/{self.target_value}) "
            f"in {self.group.name}"
        )

    @property
    def progress_pct(self):
        if self.target_value == 0:
            return 0
        return min(
            100,
            int(self.current_value / self.target_value * 100),
        )


class GroupMessage(models.Model):
    """A message posted in the group's discussion board."""

    group = models.ForeignKey(
        StudyGroup,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_messages",
    )
    content = models.TextField()
    is_pinned = models.BooleanField(default=False)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    upvotes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-created_at"]

    def __str__(self):
        return f"Msg by {self.user.username} in {self.group.name}"
