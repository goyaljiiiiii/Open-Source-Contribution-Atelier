"""
Notification engine with delivery guarantees and retries.
"""

import logging
import json
import time
from typing import Dict, Any, List, Optional, Callable
from django.db import transaction
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from celery import shared_task

from apps.notifications.models import (
    Notification, NotificationDelivery, NotificationBatch,
    NotificationPreference
)

logger = logging.getLogger(__name__)


# ============================================================
# Notification Engine
# ============================================================

class NotificationEngine:
    """
    Core notification engine with delivery guarantees.
    """
    
    def __init__(self):
        self.retry_delays = [60, 300, 900, 3600]  # 1min, 5min, 15min, 1hour
    
    def send_notification(
        self,
        user,
        notification_type: str,
        title: str,
        message: str,
        channels: List[str] = None,
        priority: int = Notification.PRIORITY_NORMAL,
        data: Dict = None,
        html_content: str = None,
        source_object=None,
        scheduled_for=None,
        expires_at=None,
        **kwargs
    ) -> Notification:
        """
        Send a notification with delivery guarantees.
        
        Args:
            user: User to send to
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            channels: List of channels to use
            priority: Priority level
            data: Additional data
            html_content: HTML version for email
            source_object: Source object for tracking
            scheduled_for: Schedule delivery time
            expires_at: Expiration time
        
        Returns:
            Notification: Created notification instance
        """
        # Check user preferences
        try:
            prefs = NotificationPreference.objects.get(user=user)
            if not prefs.is_type_enabled(notification_type):
                logger.info(f"Notification type {notification_type} disabled for {user.username}")
                return None
        except NotificationPreference.DoesNotExist:
            pass
        
        # Default channels
        if not channels:
            channels = ['in_app', 'websocket']
        
        # Create notification
        with transaction.atomic():
            notification = Notification.objects.create(
                user=user,
                type=notification_type,
                priority=priority,
                title=title,
                message=message,
                html_content=html_content or message,
                data=data or {},
                channels=channels,
                source_object=source_object,
                scheduled_for=scheduled_for,
                expires_at=expires_at,
                status=Notification.STATUS_PENDING
            )
            
            # Queue for delivery
            self._queue_notification(notification)
            
            logger.info(f"Notification created: {notification.id} for {user.username}")
            return notification
    
    def _queue_notification(self, notification: Notification):
        """
        Queue notification for delivery.
        """
        # Check if scheduled for later
        if notification.scheduled_for and notification.scheduled_for > timezone.now():
            # Schedule via Celery
            deliver_notification.apply_async(
                args=[str(notification.id)],
                eta=notification.scheduled_for
            )
            logger.info(f"Notification {notification.id} scheduled for {notification.scheduled_for}")
            return
        
        # Immediate delivery
        notification.mark_queued()
        deliver_notification.delay(str(notification.id))
    
    def deliver_notification(self, notification_id: str):
        """
        Deliver a notification through all configured channels.
        """
        try:
            notification = Notification.objects.get(id=notification_id)
        except Notification.DoesNotExist:
            logger.error(f"Notification {notification_id} not found")
            return
        
        # Check if already delivered or expired
        if notification.status in [Notification.STATUS_DELIVERED, Notification.STATUS_READ]:
            logger.info(f"Notification {notification_id} already delivered")
            return
        
        if notification.is_expired():
            logger.warning(f"Notification {notification_id} expired")
            notification.mark_failed("Notification expired")
            return
        
        # Check quiet hours
        try:
            prefs = NotificationPreference.objects.get(user=notification.user)
            if prefs.is_in_quiet_hours():
                # Reschedule for after quiet hours
                self._schedule_for_after_quiet_hours(notification, prefs)
                return
        except NotificationPreference.DoesNotExist:
            pass
        
        # Deliver through channels
        success_count = 0
        for channel in notification.channels:
            try:
                delivery = self._deliver_channel(notification, channel)
                if delivery and delivery.status == Notification.STATUS_DELIVERED:
                    success_count += 1
            except Exception as e:
                logger.error(f"Channel {channel} delivery failed: {e}")
                self._create_delivery(notification, channel, str(e))
        
        # Update notification status
        if success_count > 0:
            notification.mark_delivered()
        else:
            self._handle_delivery_failure(notification)
    
    def _deliver_channel(self, notification: Notification, channel: str) -> Optional[NotificationDelivery]:
        """
        Deliver through a specific channel.
        
        Returns:
            NotificationDelivery: Delivery record
        """
        delivery = self._create_delivery(notification, channel)
        
        try:
            if channel == NotificationDelivery.CHANNEL_EMAIL:
                self._deliver_email(notification)
            elif channel == NotificationDelivery.CHANNEL_WEBSOCKET:
                self._deliver_websocket(notification)
            elif channel == NotificationDelivery.CHANNEL_IN_APP:
                self._deliver_in_app(notification)
            elif channel == NotificationDelivery.CHANNEL_WEBHOOK:
                self._deliver_webhook(notification)
            else:
                logger.warning(f"Unknown channel: {channel}")
                delivery.mark_failed(f"Unknown channel: {channel}")
                return delivery
            
            delivery.mark_delivered()
            return delivery
            
        except Exception as e:
            logger.error(f"Channel {channel} delivery error: {e}")
            delivery.mark_failed(str(e))
            
            # Retry logic
            if delivery.retry_count < 3:
                self._schedule_retry(notification, channel)
            
            return delivery
    
    def _create_delivery(self, notification: Notification, channel: str, error: str = None) -> NotificationDelivery:
        """
        Create delivery record for a channel.
        """
        if error:
            return NotificationDelivery.objects.create(
                notification=notification,
                channel=channel,
                status=Notification.STATUS_FAILED,
                error_message=error
            )
        return NotificationDelivery.objects.create(
            notification=notification,
            channel=channel,
            status=Notification.STATUS_PENDING
        )
    
    def _deliver_email(self, notification: Notification):
        """
        Deliver via email.
        """
        # Check if email channel is enabled
        try:
            prefs = NotificationPreference.objects.get(user=notification.user)
            if not prefs.channel_email:
                logger.info(f"Email disabled for {notification.user.username}")
                return
        except NotificationPreference.DoesNotExist:
            pass
        
        # Render HTML content
        html_message = notification.html_content or notification.message
        
        # Send email
        send_mail(
            subject=notification.title,
            message=notification.message,
            from_email=None,  # Use default
            recipient_list=[notification.user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Email sent for notification {notification.id}")
    
    def _deliver_websocket(self, notification: Notification):
        """
        Deliver via WebSocket.
        """
        channel_layer = get_channel_layer()
        group_name = f"user_{notification.user.id}"
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'notification',
                'data': notification.to_dict()
            }
        )
        logger.info(f"WebSocket notification sent to {group_name}")
    
    def _deliver_in_app(self, notification: Notification):
        """
        Deliver in-app notification (already saved in DB).
        """
        # In-app notifications are just saved in the database
        # They will be fetched by the frontend
        logger.info(f"In-app notification {notification.id} delivered")
    
    def _deliver_webhook(self, notification: Notification):
        """
        Deliver via webhook.
        """
        import requests
        
        # Get webhook URL from user preferences
        # This is a placeholder - implement webhook URL storage
        webhook_url = None
        
        if webhook_url:
            response = requests.post(
                webhook_url,
                json=notification.to_dict(),
                timeout=5,
                headers={'Content-Type': 'application/json'}
            )
            response.raise_for_status()
            logger.info(f"Webhook delivered for notification {notification.id}")
        else:
            logger.warning(f"No webhook URL for {notification.user.username}")
    
    def _handle_delivery_failure(self, notification: Notification):
        """
        Handle delivery failure with retry logic.
        """
        if notification.should_retry():
            notification.increment_retry()
            self._schedule_retry(notification)
            logger.warning(f"Scheduled retry {notification.retry_count} for {notification.id}")
        else:
            notification.mark_failed("Max retries exceeded")
            logger.error(f"Notification {notification.id} failed after {notification.retry_count} retries")
    
    def _schedule_retry(self, notification: Notification, channel: str = None):
        """
        Schedule a retry with exponential backoff.
        """
        delay = self.retry_delays[min(notification.retry_count, len(self.retry_delays) - 1)]
        deliver_notification.apply_async(
            args=[str(notification.id)],
            countdown=delay
        )
    
    def _schedule_for_after_quiet_hours(self, notification: Notification, prefs: NotificationPreference):
        """
        Schedule notification for after quiet hours.
        """
        # Calculate next time after quiet hours
        now = timezone.now()
        quiet_end = prefs.quiet_hours_end
        
        if quiet_end:
            schedule_time = now.replace(
                hour=quiet_end.hour,
                minute=quiet_end.minute,
                second=quiet_end.second
            )
            
            # If quiet end is in the past, schedule for tomorrow
            if schedule_time <= now:
                schedule_time += timezone.timedelta(days=1)
            
            deliver_notification.apply_async(
                args=[str(notification.id)],
                eta=schedule_time
            )
            logger.info(f"Notification {notification.id} scheduled for after quiet hours")


# ============================================================
# Celery Tasks
# ============================================================

@shared_task(bind=True, max_retries=3)
def deliver_notification(self, notification_id: str):
    """
    Celery task to deliver notification with retries.
    """
    engine = NotificationEngine()
    
    try:
        engine.deliver_notification(notification_id)
    except Exception as e:
        logger.error(f"Notification delivery failed: {e}")
        self.retry(exc=e, countdown=60 * (self.request.retries + 1))


@shared_task
def process_batch_notifications(batch_id: str):
    """
    Process a batch of notifications.
    """
    try:
        batch = NotificationBatch.objects.get(id=batch_id)
    except NotificationBatch.DoesNotExist:
        logger.error(f"Batch {batch_id} not found")
        return
    
    batch.mark_processing()
    
    engine = NotificationEngine()
    for notification in batch.notifications.all():
        try:
            engine.deliver_notification(str(notification.id))
        except Exception as e:
            logger.error(f"Batch notification {notification.id} failed: {e}")
    
    batch.update_stats()
    batch.mark_completed()
    logger.info(f"Batch {batch_id} completed")


@shared_task
def send_daily_digests():
    """
    Send daily digests to all users.
    """
    from apps.notifications.services.digest import DailyDigest
    
    digest = DailyDigest()
    digest.send_all()


@shared_task
def cleanup_expired_notifications():
    """
    Clean up expired notifications.
    """
    cutoff = timezone.now() - timezone.timedelta(days=30)
    count = Notification.objects.filter(
        status=Notification.STATUS_DELIVERED,
        created_at__lt=cutoff
    ).delete()
    
    logger.info(f"Cleaned up {count[0]} expired notifications")


# ============================================================
# Event Listeners (Django Signals)
# ============================================================

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=Notification)
def notification_post_save(sender, instance, created, **kwargs):
    """Trigger WebSocket notification on save."""
    if created and instance.channels and 'websocket' in instance.channels:
        channel_layer = get_channel_layer()
        group_name = f"user_{instance.user.id}"
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'notification',
                'data': instance.to_dict()
            }
        )