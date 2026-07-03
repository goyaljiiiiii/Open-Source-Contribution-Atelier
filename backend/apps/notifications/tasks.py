"""
Notification services with delivery guarantees, multi-channel support, and retries.
"""

import json
import logging
import requests
from typing import Dict, Any, List, Optional, Union
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from pywebpush import WebPushException, webpush
from celery import shared_task

from .models import Notification, NotificationDelivery, PushSubscription, NotificationPreference

logger = logging.getLogger(__name__)


# ============================================================
# Notification Service
# ============================================================

class NotificationService:
    """
    Core notification service with multi-channel delivery.
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
        sender=None,
        source_object=None,
        scheduled_for=None,
        expires_at=None,
        **kwargs
    ) -> Optional[Notification]:
        """
        Send a notification through multiple channels.
        
        Args:
            user: User to send to
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            channels: List of channels to use
            priority: Priority level
            data: Additional data
            html_content: HTML version for email
            sender: User who sent the notification
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
            
            # Filter channels based on preferences
            if channels:
                channels = [c for c in channels if prefs.is_channel_enabled(c)]
            else:
                channels = self._get_enabled_channels(prefs)
                
        except NotificationPreference.DoesNotExist:
            pass
        
        # Default channels
        if not channels:
            channels = ['in_app', 'websocket']
        
        # Create notification
        notification = Notification.objects.create(
            recipient=user,
            sender=sender,
            notif_type=notification_type,
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
    
    def _get_enabled_channels(self, prefs: NotificationPreference) -> List[str]:
        """Get enabled channels from preferences."""
        channels = []
        if prefs.channel_email:
            channels.append(NotificationDelivery.CHANNEL_EMAIL)
        if prefs.channel_websocket:
            channels.append(NotificationDelivery.CHANNEL_WEBSOCKET)
        if prefs.channel_in_app:
            channels.append(NotificationDelivery.CHANNEL_IN_APP)
        if prefs.channel_webhook:
            channels.append(NotificationDelivery.CHANNEL_WEBHOOK)
        if prefs.channel_sms:
            channels.append(NotificationDelivery.CHANNEL_SMS)
        if prefs.channel_push:
            channels.append(NotificationDelivery.CHANNEL_PUSH)
        return channels
    
    def _queue_notification(self, notification: Notification):
        """Queue notification for delivery."""
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
        """Deliver a notification through all configured channels."""
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
            prefs = NotificationPreference.objects.get(user=notification.recipient)
            if prefs.is_in_quiet_hours():
                # Reschedule for after quiet hours
                self._schedule_after_quiet_hours(notification, prefs)
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
        """Deliver through a specific channel."""
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
            elif channel == NotificationDelivery.CHANNEL_PUSH:
                self._deliver_push(notification)
            elif channel == NotificationDelivery.CHANNEL_SMS:
                self._deliver_sms(notification)
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
        """Create delivery record for a channel."""
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
    
    # ============================================================
    # Channel Delivery Methods
    # ============================================================
    
    def _deliver_email(self, notification: Notification):
        """Deliver via email."""
        try:
            prefs = NotificationPreference.objects.get(user=notification.recipient)
            if not prefs.channel_email:
                return
        except NotificationPreference.DoesNotExist:
            pass
        
        # Prepare email content
        subject = notification.title
        html_content = notification.html_content or notification.message
        
        # Use template if available
        if notification.notif_type:
            try:
                html_content = render_to_string(
                    f"notifications/email/{notification.notif_type}.html",
                    {
                        'notification': notification,
                        'user': notification.recipient,
                        'data': notification.data,
                    }
                )
                plain_content = render_to_string(
                    f"notifications/email/{notification.notif_type}.txt",
                    {
                        'notification': notification,
                        'user': notification.recipient,
                        'data': notification.data,
                    }
                )
            except:
                plain_content = notification.message
                html_content = notification.html_content or notification.message
        else:
            plain_content = notification.message
            html_content = notification.html_content or notification.message
        
        # Send email
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_content,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@atelier.dev"),
            to=[notification.recipient.email],
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        logger.info(f"Email sent for notification {notification.id}")
    
    def _deliver_websocket(self, notification: Notification):
        """Deliver via WebSocket."""
        channel_layer = get_channel_layer()
        group_name = f"user_{notification.recipient.id}"
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'notification',
                'data': notification.to_dict()
            }
        )
        logger.info(f"WebSocket notification sent to {group_name}")
    
    def _deliver_in_app(self, notification: Notification):
        """Deliver in-app notification (already saved in DB)."""
        # In-app notifications are just saved in the database
        # They will be fetched by the frontend
        logger.info(f"In-app notification {notification.id} delivered")
    
    def _deliver_webhook(self, notification: Notification):
        """Deliver via webhook."""
        # Get webhook URL from user preferences or settings
        webhook_url = getattr(settings, "NOTIFICATION_WEBHOOK_URL", None)
        
        if not webhook_url:
            # Try to get from user preferences
            try:
                prefs = NotificationPreference.objects.get(user=notification.recipient)
                webhook_url = getattr(prefs, 'webhook_url', None)
            except:
                pass
        
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
            logger.debug(f"No webhook URL for {notification.recipient.username}")
    
    def _deliver_push(self, notification: Notification):
        """Deliver via Web Push notification."""
        subscriptions = PushSubscription.objects.filter(
            user=notification.recipient,
            is_active=True
        )
        
        if not subscriptions.exists():
            return
        
        # VAPID configuration
        vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", None)
        vapid_admin_email = getattr(settings, "VAPID_ADMIN_EMAIL", None)
        
        if not vapid_private_key or not vapid_admin_email:
            logger.warning("VAPID not configured for push notifications")
            return
        
        # Prepare payload
        payload_data = {
            "title": notification.title,
            "message": notification.message,
            "data": notification.data,
        }
        payload = json.dumps(payload_data)
        
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_admin_email},
                )
                logger.info(f"Push notification sent to {sub.user.username}")
            except WebPushException as ex:
                if ex.response and ex.response.status_code in [404, 410]:
                    # Endpoint no longer valid
                    sub.delete()
                    logger.info(f"Removed invalid push subscription {sub.id}")
                else:
                    logger.warning(f"Web push failed for subscription {sub.id}: {ex}")
            except Exception as e:
                logger.error(f"Unexpected error sending web push: {e}")
    
    def _deliver_sms(self, notification: Notification):
        """Deliver via SMS (placeholder implementation)."""
        # Implement SMS delivery using Twilio, AWS SNS, etc.
        # This is a placeholder
        logger.info(f"SMS delivery for notification {notification.id} (not implemented)")
    
    # ============================================================
    # Retry Logic
    # ============================================================
    
    def _handle_delivery_failure(self, notification: Notification):
        """Handle delivery failure with retry logic."""
        if notification.should_retry():
            notification.increment_retry()
            self._schedule_retry(notification)
            logger.warning(f"Scheduled retry {notification.retry_count} for {notification.id}")
        else:
            notification.mark_failed("Max retries exceeded")
            logger.error(f"Notification {notification.id} failed after {notification.retry_count} retries")
    
    def _schedule_retry(self, notification: Notification, channel: str = None):
        """Schedule a retry with exponential backoff."""
        delay = self.retry_delays[min(notification.retry_count, len(self.retry_delays) - 1)]
        deliver_notification.apply_async(
            args=[str(notification.id)],
            countdown=delay
        )
    
    def _schedule_after_quiet_hours(self, notification: Notification, prefs: NotificationPreference):
        """Schedule notification for after quiet hours."""
        quiet_end = prefs.quiet_hours_end
        
        if quiet_end:
            now = timezone.now()
            schedule_time = now.replace(
                hour=quiet_end.hour,
                minute=quiet_end.minute,
                second=quiet_end.second
            )
            
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
    service = NotificationService()
    
    try:
        service.deliver_notification(notification_id)
    except Exception as e:
        logger.error(f"Notification delivery failed: {e}")
        self.retry(exc=e, countdown=60 * (self.request.retries + 1))


@shared_task
def send_web_push_notification(user_id: int, title: str, message: str, url: str = None, data: Dict = None):
    """
    Send Web Push notification to a user.
    
    Args:
        user_id: User ID
        title: Notification title
        message: Notification message
        url: Optional URL to open
        data: Additional data
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return
    
    subscriptions = PushSubscription.objects.filter(user=user, is_active=True)
    if not subscriptions.exists():
        return
    
    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", None)
    vapid_admin_email = getattr(settings, "VAPID_ADMIN_EMAIL", None)
    
    if not vapid_private_key or not vapid_admin_email:
        logger.warning("VAPID not configured for push notifications")
        return
    
    payload_data = {
        "title": title,
        "message": message,
        "data": data or {},
    }
    if url:
        payload_data["url"] = url
    
    payload = json.dumps(payload_data)
    
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_admin_email},
            )
            logger.info(f"Push notification sent to {sub.user.username}")
        except WebPushException as ex:
            if ex.response and ex.response.status_code in [404, 410]:
                sub.delete()
                logger.info(f"Removed invalid push subscription {sub.id}")
            else:
                logger.warning(f"Web push failed for subscription {sub.id}: {ex}")
        except Exception as exc:
            logger.warning(f"Unexpected error sending web push to user {user_id}: {exc}")


@shared_task
def send_bulk_emails(email_data: Dict):
    """
    Send bulk emails with templates.
    
    Args:
        email_data: Dictionary with email data
    """
    template_id = email_data.get("template_id")
    recipients = email_data.get("recipients", [])
    data = email_data.get("data", {})
    
    if not recipients:
        return
    
    subject = "Open Source Contribution Atelier Update"
    message = "You have an update from OSCA."
    html_content = None
    
    # Email templates
    if template_id == "weekly_progress_summary":
        subject = "Your Weekly Progress Summary"
        message = (
            f"Hi {data.get('username')},\n\n"
            f"Here is your progress over the last 7 days:\n"
            f"- Lessons completed: {data.get('lessons_completed', 0)}\n"
            f"- XP earned: {data.get('xp_earned', 0)}\n"
            f"- Badges earned: {data.get('badges_earned', 0)}\n"
        )
        if data.get("badge_names"):
            badges_str = ", ".join(data["badge_names"])
            message += f"- New badges: {badges_str}\n"
        message += "\nKeep up the great work!\n"
        
        html_content = f"""
        <h2>Your Weekly Progress Summary</h2>
        <p>Hi {data.get('username')},</p>
        <p>Here is your progress over the last 7 days:</p>
        <ul>
            <li>Lessons completed: <strong>{data.get('lessons_completed', 0)}</strong></li>
            <li>XP earned: <strong>{data.get('xp_earned', 0)}</strong></li>
            <li>Badges earned: <strong>{data.get('badges_earned', 0)}</strong></li>
        </ul>
        <p>Keep up the great work!</p>
        """
    
    elif template_id == "badge_earned_email":
        badge_name = data.get("badge_name", "")
        username = data.get("username", "")
        subject = "🏅 You Earned a New Badge!"
        message = f"Hi {username},\n\nCongratulations! You earned the '{badge_name}' badge.\n\nKeep up the great work!"
        html_content = f"""
        <h2>🏅 You Earned a New Badge!</h2>
        <p>Hi {username},</p>
        <p>Congratulations! You earned the <strong>'{badge_name}'</strong> badge.</p>
        <p>Keep up the great work!</p>
        """
    
    elif template_id == "welcome_email":
        username = data.get("username", "")
        subject = "Welcome to Open Source Contribution Atelier!"
        message = f"Hi {username},\n\nWelcome to OSCA! We're excited to have you on board.\n\nStart your learning journey today!"
        html_content = f"""
        <h2>Welcome to Open Source Contribution Atelier!</h2>
        <p>Hi {username},</p>
        <p>We're excited to have you on board. Start your learning journey today!</p>
        """
    
    # Send emails
    for recipient in recipients:
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@atelier.dev"),
                recipient_list=[recipient],
                html_message=html_content,
                fail_silently=False,
            )
            logger.info(f"Email sent to {recipient}")
        except Exception as e:
            logger.error(f"Failed to send email to {recipient}: {e}")


@shared_task
def send_badge_notification(user_id: int, badge_name: str, badge_id: int = None):
    """
    Send badge earned notification through all channels.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        return
    
    service = NotificationService()
    service.send_notification(
        user=user,
        notification_type="badge",
        title="🏅 Badge Earned!",
        message=f"Congratulations! You earned the '{badge_name}' badge!",
        channels=["email", "websocket", "in_app", "push"],
        priority=Notification.PRIORITY_HIGH,
        data={"badge_id": badge_id, "badge_name": badge_name},
    )


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