"""
Notification models with delivery guarantees, batching, and user preferences.
"""

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class Notification(models.Model):
    """
    Core notification model with delivery tracking and retries.
    """
    
    # ============================================================
    # Notification Types (Extended)
    # ============================================================
    
    NOTIFICATION_TYPES = [
        ("badge", "Badge Earned"),
        ("comment", "New Comment"),
        ("achievement", "Achievement Unlocked"),
        ("lesson_completed", "Lesson Completed"),
        ("module_completed", "Module Completed"),
        ("certificate_generated", "Certificate Generated"),
        ("mentor_message", "Mentor Message"),
        ("system", "System"),
        ("reminder", "Reminder"),
        ("announcement", "Announcement"),
        ("streak", "Streak Update"),
        ("challenge", "New Challenge"),
    ]
    
    # ============================================================
    # Priority Levels
    # ============================================================
    
    PRIORITY_LOW = 0
    PRIORITY_NORMAL = 1
    PRIORITY_HIGH = 2
    PRIORITY_URGENT = 3
    
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_NORMAL, "Normal"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_URGENT, "Urgent"),
    ]
    
    # ============================================================
    # Delivery Status
    # ============================================================
    
    STATUS_PENDING = "pending"
    STATUS_QUEUED = "queued"
    STATUS_SENT = "sent"
    STATUS_DELIVERED = "delivered"
    STATUS_READ = "read"
    STATUS_FAILED = "failed"
    STATUS_BOUNCED = "bounced"
    
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_QUEUED, "Queued"),
        (STATUS_SENT, "Sent"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_READ, "Read"),
        (STATUS_FAILED, "Failed"),
        (STATUS_BOUNCED, "Bounced"),
    ]
    
    objects = models.Manager()
    
    # ============================================================
    # Core Fields
    # ============================================================
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    
    # Type and priority
    notif_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, db_index=True)
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    
    # Content
    title = models.CharField(max_length=255)
    message = models.TextField()
    html_content = models.TextField(blank=True, help_text="HTML version for email")
    
    # Read/Status tracking
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Delivery status (new)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True
    )
    
    # Channels configuration
    channels = models.JSONField(
        default=list,
        help_text="List of channels: ['email', 'websocket', 'in_app', 'webhook']"
    )
    
    # Additional data
    meta = models.JSONField(default=dict, blank=True, help_text="Extra payload")
    data = models.JSONField(default=dict, blank=True, help_text="Structured data")
    
    # Generic relation for source object
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    source_object = GenericForeignKey("content_type", "object_id")
    
    # ============================================================
    # Delivery Tracking
    # ============================================================
    
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Retry tracking
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    last_error = models.TextField(blank=True)
    error_stack = models.JSONField(default=list)
    
    # ============================================================
    # Scheduling
    # ============================================================
    
    scheduled_for = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # ============================================================
    # Timestamps
    # ============================================================
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "status"]),
            models.Index(fields=["recipient", "created_at"]),
            models.Index(fields=["notif_type", "status"]),
            models.Index(fields=["scheduled_for"]),
            models.Index(fields=["recipient", "read_at"]),
        ]

    def __str__(self):
        return f"[{self.notif_type}] → {self.recipient} | {self.title}"
    
    # ============================================================
    # Status Methods
    # ============================================================
    
    def mark_queued(self):
        """Mark notification as queued."""
        self.status = self.STATUS_QUEUED
        self.save(update_fields=["status", "updated_at"])
    
    def mark_sent(self):
        """Mark notification as sent."""
        self.status = self.STATUS_SENT
        self.sent_at = timezone.now()
        self.save(update_fields=["status", "sent_at", "updated_at"])
    
    def mark_delivered(self):
        """Mark notification as delivered."""
        self.status = self.STATUS_DELIVERED
        self.delivered_at = timezone.now()
        self.save(update_fields=["status", "delivered_at", "updated_at"])
    
    def mark_read(self):
        """Mark notification as read."""
        self.is_read = True
        self.status = self.STATUS_READ
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "status", "read_at", "updated_at"])
    
    def mark_failed(self, error: str):
        """Mark notification as failed."""
        self.status = self.STATUS_FAILED
        self.last_error = error
        self.error_stack.append({
            "timestamp": timezone.now().isoformat(),
            "error": error,
            "retry_count": self.retry_count
        })
        self.save(update_fields=["status", "last_error", "error_stack", "updated_at"])
    
    def should_retry(self) -> bool:
        """Check if notification should be retried."""
        return self.retry_count < self.max_retries
    
    def increment_retry(self):
        """Increment retry count."""
        self.retry_count += 1
        self.save(update_fields=["retry_count", "updated_at"])
    
    def is_expired(self) -> bool:
        """Check if notification has expired."""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False
    
    # ============================================================
    # Utility Methods
    # ============================================================
    
    def to_dict(self):
        """Convert notification to dictionary for API/WebSocket."""
        return {
            "id": str(self.id),
            "type": self.notif_type,
            "title": self.title,
            "message": self.message,
            "html_content": self.html_content,
            "data": self.data,
            "meta": self.meta,
            "channels": self.channels,
            "priority": self.priority,
            "is_read": self.is_read,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }


class NotificationBatch(models.Model):
    """
    Batch of notifications for grouped delivery.
    """
    
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]
    
    objects = models.Manager()
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notification_batches"
    )
    notifications = models.ManyToManyField(
        Notification,
        related_name="batches"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    total_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)
    
    # Batching configuration
    batch_type = models.CharField(max_length=50, default="digest")
    interval_minutes = models.IntegerField(default=15)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["created_at"]),
        ]
    
    def __str__(self):
        return f"Batch {self.id} - {self.user.username}"
    
    def mark_processing(self):
        """Mark batch as processing."""
        self.status = self.STATUS_PROCESSING
        self.save(update_fields=["status", "updated_at"])
    
    def mark_completed(self):
        """Mark batch as completed."""
        self.status = self.STATUS_COMPLETED
        self.processed_at = timezone.now()
        self.save(update_fields=["status", "processed_at", "updated_at"])
    
    def mark_failed(self):
        """Mark batch as failed."""
        self.status = self.STATUS_FAILED
        self.save(update_fields=["status", "updated_at"])
    
    def update_stats(self):
        """Update batch statistics."""
        self.total_count = self.notifications.count()
        self.success_count = self.notifications.filter(
            status=Notification.STATUS_DELIVERED
        ).count()
        self.failure_count = self.notifications.filter(
            status=Notification.STATUS_FAILED
        ).count()
        self.save(update_fields=["total_count", "success_count", "failure_count"])


class NotificationDelivery(models.Model):
    """
    Track delivery for each channel.
    """
    
    CHANNEL_EMAIL = "email"
    CHANNEL_WEBSOCKET = "websocket"
    CHANNEL_IN_APP = "in_app"
    CHANNEL_WEBHOOK = "webhook"
    CHANNEL_SMS = "sms"
    CHANNEL_PUSH = "push"
    
    CHANNEL_CHOICES = [
        (CHANNEL_EMAIL, "Email"),
        (CHANNEL_WEBSOCKET, "WebSocket"),
        (CHANNEL_IN_APP, "In-App"),
        (CHANNEL_WEBHOOK, "Webhook"),
        (CHANNEL_SMS, "SMS"),
        (CHANNEL_PUSH, "Push Notification"),
    ]
    
    objects = models.Manager()
    
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="deliveries"
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    status = models.CharField(
        max_length=20,
        choices=Notification.STATUS_CHOICES,
        default=Notification.STATUS_PENDING
    )
    external_id = models.CharField(max_length=255, blank=True, help_text="External provider ID")
    response_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["notification", "channel"]),
            models.Index(fields=["status"]),
        ]
    
    def __str__(self):
        return f"{self.notification.title} - {self.channel}"
    
    def mark_sent(self):
        """Mark as sent."""
        self.status = Notification.STATUS_SENT
        self.sent_at = timezone.now()
        self.save(update_fields=["status", "sent_at", "updated_at"])
    
    def mark_delivered(self):
        """Mark as delivered."""
        self.status = Notification.STATUS_DELIVERED
        self.delivered_at = timezone.now()
        self.save(update_fields=["status", "delivered_at", "updated_at"])
    
    def mark_failed(self, error: str):
        """Mark as failed."""
        self.status = Notification.STATUS_FAILED
        self.error_message = error
        self.save(update_fields=["status", "error_message", "updated_at"])


class NotificationPreference(models.Model):
    """
    User notification preferences with granular controls.
    """
    
    FREQUENCY_REALTIME = "realtime"
    FREQUENCY_HOURLY = "hourly"
    FREQUENCY_DAILY = "daily"
    FREQUENCY_WEEKLY = "weekly"
    FREQUENCY_NEVER = "never"
    
    FREQUENCY_CHOICES = [
        (FREQUENCY_REALTIME, "Real-time"),
        (FREQUENCY_HOURLY, "Hourly Digest"),
        (FREQUENCY_DAILY, "Daily Digest"),
        (FREQUENCY_WEEKLY, "Weekly Digest"),
        (FREQUENCY_NEVER, "Never"),
    ]
    
    objects = models.Manager()
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="notification_preferences"
    )
    
    # Global settings
    enabled = models.BooleanField(default=True)
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default=FREQUENCY_REALTIME
    )
    
    # Channel preferences
    channel_email = models.BooleanField(default=True)
    channel_websocket = models.BooleanField(default=True)
    channel_in_app = models.BooleanField(default=True)
    channel_webhook = models.BooleanField(default=False)
    channel_sms = models.BooleanField(default=False)
    channel_push = models.BooleanField(default=False)
    
    # Type preferences (JSON)
    type_preferences = models.JSONField(
        default=dict,
        help_text="Per-type preferences: {'badge': True, 'comment': False}"
    )
    
    # Quiet hours
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    quiet_hours_enabled = models.BooleanField(default=False)
    
    # Digest settings
    digest_time = models.TimeField(default="09:00:00")
    digest_day = models.IntegerField(default=1)  # 1=Monday
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "notification_preferences"
    
    def __str__(self):
        return f"Preferences for {self.user.username}"
    
    def is_type_enabled(self, notification_type: str) -> bool:
        """Check if a specific type is enabled."""
        if not self.enabled:
            return False
        return self.type_preferences.get(notification_type, True)
    
    def is_channel_enabled(self, channel: str) -> bool:
        """Check if a specific channel is enabled."""
        channel_map = {
            NotificationDelivery.CHANNEL_EMAIL: self.channel_email,
            NotificationDelivery.CHANNEL_WEBSOCKET: self.channel_websocket,
            NotificationDelivery.CHANNEL_IN_APP: self.channel_in_app,
            NotificationDelivery.CHANNEL_WEBHOOK: self.channel_webhook,
            NotificationDelivery.CHANNEL_SMS: self.channel_sms,
            NotificationDelivery.CHANNEL_PUSH: self.channel_push,
        }
        return channel_map.get(channel, False)
    
    def is_in_quiet_hours(self) -> bool:
        """Check if current time is in quiet hours."""
        if not self.quiet_hours_enabled:
            return False
        
        now = timezone.now().time()
        if self.quiet_hours_start and self.quiet_hours_end:
            if self.quiet_hours_start < self.quiet_hours_end:
                return self.quiet_hours_start <= now <= self.quiet_hours_end
            else:
                # Overnight quiet hours
                return now >= self.quiet_hours_start or now <= self.quiet_hours_end
        return False


class PushSubscription(models.Model):
    """
    Push notification subscription for Web Push API.
    """
    
    objects = models.Manager()
    
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    
    # Additional fields
    user_agent = models.TextField(blank=True)
    device_type = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PushSubscription(user={self.user.username})"
    
    def deactivate(self):
        """Deactivate the subscription."""
        self.is_active = False
        self.save(update_fields=["is_active", "updated_at"])