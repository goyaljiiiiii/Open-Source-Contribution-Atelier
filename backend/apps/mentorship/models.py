"""
Mentorship Matching & Tracking models.

Connects experienced learners (mentors) with beginners (mentees),
tracks mentorship sessions, collects feedback, and provides analytics
on mentorship program effectiveness.
"""

from __future__ import annotations

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class MentorProfile(models.Model):
    """Extended profile for users acting as mentors."""

    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "available", "Available"
        BUSY = "busy", "Busy"
        UNAVAILABLE = "unavailable", "Unavailable"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentorship_mentor_profile",
    )
    bio = models.TextField(
        blank=True,
        help_text="Short bio describing mentoring style and expertise.",
    )
    expertise_areas = models.JSONField(
        default=list,
        blank=True,
        help_text='List of skill slugs, e.g. ["python", "git-basics"].',
    )
    years_experience = models.PositiveIntegerField(
        default=0,
        help_text="Approximate years of programming experience.",
    )
    max_mentees = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(20)],
        help_text="Maximum concurrent mentees.",
    )
    current_mentee_count = models.PositiveIntegerField(default=0)
    availability = models.CharField(
        max_length=15,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
        db_index=True,
    )
    preferred_session_duration = models.PositiveIntegerField(
        default=30,
        help_text="Preferred session length in minutes.",
    )
    languages = models.JSONField(
        default=list,
        blank=True,
        help_text='Spoken languages, e.g. ["en", "es"].',
    )
    timezone_name = models.CharField(
        max_length=50,
        blank=True,
        default="UTC",
    )
    total_sessions_mentored = models.PositiveIntegerField(default=0)
    total_hours_mentored = models.FloatField(default=0.0)
    average_rating = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(5.0)],
    )
    rating_count = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(
        default=False,
        help_text="Verified by an admin after review.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-average_rating", "-total_sessions_mentored"]
        indexes = [
            models.Index(
                fields=["availability", "-average_rating"],
                name="idx_mp_avail_rating",
            ),
            models.Index(
                fields=["is_active", "availability"],
                name="idx_mp_active_avail",
            ),
        ]

    def __str__(self):
        return (
            f"Mentor: {self.user.username} "
            f"(★{self.average_rating:.1f}, "
            f"{self.total_sessions_mentored} sessions)"
        )

    @property
    def is_full(self):
        return self.current_mentee_count >= self.max_mentees

    @property
    def acceptance_rate(self):
        total = MentorshipRequest.objects.filter(
            mentor=self.user
        ).count()
        if total == 0:
            return 0.0
        accepted = MentorshipRequest.objects.filter(
            mentor=self.user, status="accepted"
        ).count()
        return round(accepted / total * 100, 1)

    def recalculate_stats(self):
        from django.db.models import Avg, Count, Sum

        agg = MentorshipSession.objects.filter(
            mentor=self.user,
            status="completed",
        ).aggregate(
            count=Count("id"),
            total_minutes=Sum("duration_minutes"),
            avg_rating=Avg("mentor_rating"),
            rating_count=Count("mentor_rating"),
        )
        self.total_sessions_mentored = agg["count"] or 0
        self.total_hours_mentored = round(
            (agg["total_minutes"] or 0) / 60, 1
        )
        self.average_rating = round(agg["avg_rating"] or 0, 1)
        self.rating_count = agg["rating_count"] or 0
        self.save(update_fields=[
            "total_sessions_mentored",
            "total_hours_mentored",
            "average_rating",
            "rating_count",
            "updated_at",
        ])


class MentorshipRequest(models.Model):
    """A mentee's request to be paired with a mentor."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        CANCELLED = "cancelled", "Cancelled"
        EXPIRED = "expired", "Expired"

    mentee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentorship_requests",
    )
    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_requests",
    )
    subject = models.CharField(
        max_length=255,
        help_text="What you want to learn.",
    )
    message = models.TextField(
        blank=True,
        help_text="Introduction and learning goals.",
    )
    skill_wanted = models.SlugField(
        blank=True,
        help_text="Specific skill slug the mentee wants help with.",
    )
    preferred_frequency = models.CharField(
        max_length=20,
        choices=[
            ("weekly", "Weekly"),
            ("biweekly", "Bi-Weekly"),
            ("monthly", "Monthly"),
            ("flexible", "Flexible"),
        ],
        default="weekly",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    response_message = models.TextField(
        blank=True,
        help_text="Mentor's response message.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(
        help_text="Request auto-expires after this time.",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["mentor", "status"],
                name="idx_mr_mentor_status",
            ),
            models.Index(
                fields=["mentee", "status"],
                name="idx_mr_mentee_status",
            ),
        ]

    def __str__(self):
        return (
            f"{self.mentee.username} → {self.mentor.username}: "
            f"{self.subject} ({self.status})"
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


class MentorshipMatch(models.Model):
    """An active mentorship pairing between two users."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"
        TERMINATED = "terminated", "Terminated"

    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentorship_matches_as_mentor",
    )
    mentee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentorship_matches_as_mentee",
    )
    request = models.OneToOneField(
        MentorshipRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="match",
    )
    skill_focus = models.SlugField(
        blank=True,
        help_text="Primary skill this mentorship focuses on.",
    )
    goals = models.JSONField(
        default=list,
        blank=True,
        help_text="Structured learning goals for this mentorship.",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(null=True, blank=True)
    total_sessions = models.PositiveIntegerField(default=0)
    total_hours = models.FloatField(default=0.0)
    mentor_xp_earned = models.PositiveIntegerField(default=0)
    mentee_xp_earned = models.PositiveIntegerField(default=0)
    notes = models.TextField(
        blank=True,
        help_text="Shared notes between mentor and mentee.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("mentor", "mentee")
        indexes = [
            models.Index(
                fields=["mentor", "status"],
                name="idx_mm_mentor_status",
            ),
            models.Index(
                fields=["mentee", "status"],
                name="idx_mm_mentee_status",
            ),
        ]

    def __str__(self):
        return (
            f"{self.mentor.username} → {self.mentee.username} "
            f"({self.skill_focus or 'general'})"
        )


class MentorshipSession(models.Model):
    """A single mentorship meeting/session."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No Show"

    match = models.ForeignKey(
        MentorshipMatch,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentored_sessions",
    )
    mentee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentoring_sessions",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True,
    )
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(
        default=30,
        help_text="Actual or planned session duration.",
    )
    topics_covered = models.JSONField(
        default=list,
        blank=True,
        help_text='Topics discussed, e.g. ["git merge", "rebasing"].',
    )
    action_items = models.JSONField(
        default=list,
        blank=True,
        help_text="Follow-up tasks for the mentee.",
    )
    mentee_notes = models.TextField(
        blank=True,
        help_text="Notes from the mentee's perspective.",
    )
    mentor_notes = models.TextField(
        blank=True,
        help_text="Notes from the mentor's perspective.",
    )
    # Ratings (1-5)
    mentor_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Mentee's rating of the mentor for this session.",
    )
    mentee_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Mentor's rating of the mentee for this session.",
    )
    mentor_feedback = models.TextField(blank=True)
    mentee_feedback = models.TextField(blank=True)
    xp_awarded_mentor = models.PositiveIntegerField(default=0)
    xp_awarded_mentee = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_at"]
        indexes = [
            models.Index(
                fields=["match", "status"],
                name="idx_ms_match_status",
            ),
            models.Index(
                fields=["scheduled_at", "status"],
                name="idx_ms_sched_status",
            ),
        ]

    def __str__(self):
        return (
            f"Session: {self.title} "
            f"({self.mentor.username} → {self.mentee.username})"
        )

    def start_session(self):
        self.status = self.Status.IN_PROGRESS
        self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at"])

    def complete_session(self, duration_minutes=None):
        self.status = self.Status.COMPLETED
        self.ended_at = timezone.now()
        if duration_minutes:
            self.duration_minutes = duration_minutes
        elif self.started_at:
            self.duration_minutes = max(
                1,
                int((self.ended_at - self.started_at).total_seconds() / 60),
            )
        self.save(update_fields=[
            "status", "ended_at", "duration_minutes",
        ])

        # Update match stats
        match = self.match
        match.total_sessions += 1
        match.total_hours += round(self.duration_minutes / 60, 2)
        match.save(update_fields=["total_sessions", "total_hours"])

        # Update mentor profile
        match.mentor.mentor_profile.recalculate_stats()


class MentorshipGoal(models.Model):
    """Learning goal set within a mentorship match."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ACHIEVED = "achieved", "Achieved"
        ABANDONED = "abandoned", "Abandoned"

    match = models.ForeignKey(
        MentorshipMatch,
        on_delete=models.CASCADE,
        related_name="mentorship_goals",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_mentorship_goals",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    target_date = models.DateField(null=True, blank=True)
    achieved_date = models.DateField(null=True, blank=True)
    progress_pct = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.status} {self.progress_pct}%)"


class MentorshipFeedback(models.Model):
    """Periodic feedback about the overall mentorship relationship."""

    class FeedbackType(models.TextChoices):
        MENTOR_ON_MENTEE = "mentor_on_mentee", "Mentor → Mentee"
        MENTEE_ON_MENTOR = "mentee_on_mentor", "Mentee → Mentor"

    match = models.ForeignKey(
        MentorshipMatch,
        on_delete=models.CASCADE,
        related_name="feedbacks",
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="given_mentorship_feedback",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_mentorship_feedback",
    )
    feedback_type = models.CharField(
        max_length=20,
        choices=FeedbackType.choices,
    )
    overall_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    communication_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    helpfulness_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    is_anonymous = models.BooleanField(
        default=False,
        help_text="Hide the reviewer's identity from the report.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"Feedback {self.feedback_type}: "
            f"{self.from_user.username} → {self.to_user.username} "
            f"(★{self.overall_rating})"
        )


class MentorshipMilestone(models.Model):
    """Milestones achieved during a mentorship."""

    match = models.ForeignKey(
        MentorshipMatch,
        on_delete=models.CASCADE,
        related_name="milestones",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="mentorship_milestones",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    xp_awarded = models.PositiveIntegerField(default=50)
    achieved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-achieved_at"]

    def __str__(self):
        return (
            f"{self.user.username}: {self.title} "
            f"(+{self.xp_awarded} XP)"
        )
