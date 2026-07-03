"""
Digest notification services for batching.
"""

import logging
from typing import List, Dict, Any
from django.utils import timezone
from django.db.models import Q
from django.template.loader import render_to_string
from django.core.mail import send_mail

from apps.notifications.models import Notification, NotificationBatch, NotificationPreference

logger = logging.getLogger(__name__)


class DailyDigest:
    """
    Daily digest email service.
    """
    
    def __init__(self):
        self.digest_time = timezone.now().replace(hour=9, minute=0, second=0)
    
    def send_all(self):
        """
        Send daily digests to all users.
        """
        # Get all users with daily digest preference
        preferences = NotificationPreference.objects.filter(
            enabled=True,
            frequency=NotificationPreference.FREQUENCY_DAILY
        )
        
        for pref in preferences:
            self.send_digest(pref.user)
    
    def send_digest(self, user):
        """
        Send digest to a specific user.
        """
        # Get notifications from last 24 hours
        yesterday = timezone.now() - timezone.timedelta(days=1)
        notifications = Notification.objects.filter(
            user=user,
            created_at__gte=yesterday,
            status=Notification.STATUS_DELIVERED
        ).order_by('created_at')
        
        if not notifications:
            logger.info(f"No notifications for {user.username} digest")
            return
        
        # Group by type
        grouped = {}
        for notification in notifications:
            if notification.type not in grouped:
                grouped[notification.type] = []
            grouped[notification.type].append(notification)
        
        # Create digest email
        context = {
            'user': user,
            'notifications': notifications,
            'grouped': grouped,
            'total_count': notifications.count(),
            'date': timezone.now().date(),
        }
        
        # Render email
        html_content = render_to_string('notifications/digest_email.html', context)
        plain_content = render_to_string('notifications/digest_email.txt', context)
        
        # Send email
        send_mail(
            subject=f"Your Daily Digest - {timezone.now().date()}",
            message=plain_content,
            from_email=None,
            recipient_list=[user.email],
            html_message=html_content,
            fail_silently=False,
        )
        
        logger.info(f"Daily digest sent to {user.username}")
    
    def create_batch(self, user, notifications: List[Notification]) -> NotificationBatch:
        """
        Create a batch of notifications for digest.
        """
        batch = NotificationBatch.objects.create(
            user=user,
            batch_type='digest',
            interval_minutes=15
        )
        
        for notification in notifications:
            batch.notifications.add(notification)
        
        batch.update_stats()
        return batch


class DigestScheduler:
    """
    Schedule digest notifications.
    """
    
    def __init__(self):
        self.frequency_map = {
            NotificationPreference.FREQUENCY_HOURLY: 60,
            NotificationPreference.FREQUENCY_DAILY: 1440,
            NotificationPreference.FREQUENCY_WEEKLY: 10080,
        }
    
    def schedule_digests(self):
        """
        Schedule digest tasks for all users.
        """
        preferences = NotificationPreference.objects.filter(enabled=True)
        
        for pref in preferences:
            frequency = pref.frequency
            if frequency in self.frequency_map:
                minutes = self.frequency_map[frequency]
                # Schedule digest task
                # Implementation depends on Celery beat scheduling
                pass