"""
WebSocket consumers for real-time dashboard updates with connection throttling.
"""

import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Set

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.contrib.auth.models import User
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)

# ============================================================
# RATE LIMITING CONFIGURATION
# ============================================================

RATE_LIMIT_CONFIG = {
    'max_connections_per_minute': 5,      # Max 5 connections per minute
    'max_concurrent_connections': 2,       # Max 2 concurrent connections per user
    'idle_timeout_seconds': 300,           # 5 minutes idle timeout
    'cleanup_interval_seconds': 60,        # Cleanup check every 60 seconds
}

# WebSocket close codes
CLOSE_CODE_RATE_LIMIT = 4000
CLOSE_CODE_CONCURRENT_LIMIT = 4001
CLOSE_CODE_IDLE_TIMEOUT = 4002
CLOSE_CODE_SERVER_ERROR = 4003


# ============================================================
# CONNECTION RATE LIMITER
# ============================================================

class ConnectionRateLimiter:
    """
    Rate limiter for WebSocket connections using Redis cache.
    """
    
    @staticmethod
    def get_cache_key(user_id: int, ip_address: str) -> str:
        """Generate cache key for rate limiting."""
        return f"ws_rate_limit_{user_id}_{ip_address}"
    
    @staticmethod
    async def check_rate_limit(user_id: int, ip_address: str) -> bool:
        """
        Check if user/IP has exceeded rate limit.
        
        Args:
            user_id: User ID (0 for anonymous)
            ip_address: Client IP address
        
        Returns:
            bool: True if within limit, False if exceeded
        """
        key = ConnectionRateLimiter.get_cache_key(user_id, ip_address)
        
        # Get current connection count for this user/IP
        count = await sync_to_async(cache.get)(key, 0)
        
        if count >= RATE_LIMIT_CONFIG['max_connections_per_minute']:
            logger.warning(
                f"Rate limit exceeded for user {user_id} from {ip_address}"
            )
            return False
        
        # Increment count
        await sync_to_async(cache.set)(
            key,
            count + 1,
            60  # Expire after 1 minute
        )
        return True
    
    @staticmethod
    async def decrement_count(user_id: int, ip_address: str):
        """Decrement connection count when connection closes."""
        key = ConnectionRateLimiter.get_cache_key(user_id, ip_address)
        count = await sync_to_async(cache.get)(key, 0)
        if count > 0:
            await sync_to_async(cache.set)(key, count - 1, 60)


# ============================================================
# CONNECTION MANAGER
# ============================================================

class ConnectionManager:
    """
    Manages active WebSocket connections with concurrency limits.
    """
    
    @staticmethod
    def get_active_connections_key(user_id: int) -> str:
        """Get cache key for active connections."""
        return f"ws_active_connections_{user_id}"
    
    @staticmethod
    async def can_connect(user_id: int) -> bool:
        """
        Check if user can open another connection.
        
        Args:
            user_id: User ID
        
        Returns:
            bool: True if can connect, False if max concurrent reached
        """
        if user_id == 0:  # Anonymous users
            return True
        
        key = ConnectionManager.get_active_connections_key(user_id)
        active_connections = await sync_to_async(cache.get)(key, set())
        
        if len(active_connections) >= RATE_LIMIT_CONFIG['max_concurrent_connections']:
            logger.warning(
                f"Max concurrent connections reached for user {user_id}"
            )
            return False
        
        return True
    
    @staticmethod
    async def add_connection(user_id: int, channel_name: str):
        """Add a new connection to the active set."""
        if user_id == 0:
            return
        
        key = ConnectionManager.get_active_connections_key(user_id)
        active_connections = await sync_to_async(cache.get)(key, set())
        active_connections.add(channel_name)
        await sync_to_async(cache.set)(
            key,
            active_connections,
            RATE_LIMIT_CONFIG['idle_timeout_seconds']
        )
    
    @staticmethod
    async def remove_connection(user_id: int, channel_name: str):
        """Remove a connection from the active set."""
        if user_id == 0:
            return
        
        key = ConnectionManager.get_active_connections_key(user_id)
        active_connections = await sync_to_async(cache.get)(key, set())
        if channel_name in active_connections:
            active_connections.remove(channel_name)
            await sync_to_async(cache.set)(
                key,
                active_connections,
                RATE_LIMIT_CONFIG['idle_timeout_seconds']
            )
    
    @staticmethod
    async def get_active_connections(user_id: int) -> Set[str]:
        """Get all active connections for a user."""
        if user_id == 0:
            return set()
        
        key = ConnectionManager.get_active_connections_key(user_id)
        return await sync_to_async(cache.get)(key, set())


# ============================================================
# BASE CONSUMER WITH THROTTLING
# ============================================================

class ThrottledWebsocketConsumer(AsyncWebsocketConsumer):
    """
    Base WebSocket consumer with connection throttling and resource limits.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_id = 0
        self.ip_address = ""
        self.last_activity = None
        self._idle_check_task = None
    
    async def connect(self):
        """
        Handle WebSocket connection with throttling checks.
        """
        # Get user and IP
        self.user_id = self.scope.get('user', {}).id if self.scope.get('user') else 0
        self.ip_address = self.scope.get('client', ['unknown'])[0]
        
        # Check rate limit
        if not await ConnectionRateLimiter.check_rate_limit(
            self.user_id, self.ip_address
        ):
            logger.warning(
                f"Rate limit exceeded for {self.user_id} from {self.ip_address}"
            )
            await self.close(code=CLOSE_CODE_RATE_LIMIT)
            return
        
        # Check concurrent connection limit
        if not await ConnectionManager.can_connect(self.user_id):
            logger.warning(
                f"Concurrent limit reached for user {self.user_id}"
            )
            await self.close(code=CLOSE_CODE_CONCURRENT_LIMIT)
            return
        
        # Accept the connection
        await self.accept()
        
        # Register connection
        await ConnectionManager.add_connection(self.user_id, self.channel_name)
        self.last_activity = datetime.now()
        
        # Start idle timeout check
        self._start_idle_check()
        
        # Log successful connection
        logger.info(
            f"WebSocket connected: user={self.user_id}, ip={self.ip_address}, "
            f"channel={self.channel_name}"
        )
        
        # Send connection success message
        await self.send_json({
            'type': 'connection_established',
            'message': 'Connected successfully',
            'user_id': self.user_id,
            'timestamp': datetime.now().isoformat()
        })
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """
        # Cancel idle check
        if self._idle_check_task:
            self._idle_check_task.cancel()
        
        # Remove from active connections
        await ConnectionManager.remove_connection(self.user_id, self.channel_name)
        
        # Decrement rate limit count
        await ConnectionRateLimiter.decrement_count(self.user_id, self.ip_address)
        
        # Log disconnection
        logger.info(
            f"WebSocket disconnected: user={self.user_id}, "
            f"code={close_code}, channel={self.channel_name}"
        )
    
    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming messages with activity tracking.
        """
        # Update last activity time
        self.last_activity = datetime.now()
        
        try:
            data = json.loads(text_data) if text_data else {}
            
            # Process message based on type
            message_type = data.get('type', 'unknown')
            
            if message_type == 'ping':
                # Respond to ping with pong
                await self.send_json({
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                })
            elif message_type == 'subscribe':
                # Handle subscription requests
                await self._handle_subscribe(data)
            else:
                # Handle other message types
                await self._handle_message(data)
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")
            await self.send_json({
                'type': 'error',
                'message': 'Invalid JSON format'
            })
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            await self.send_json({
                'type': 'error',
                'message': 'Error processing message'
            })
    
    async def _handle_subscribe(self, data):
        """Handle subscription requests."""
        channel = data.get('channel')
        if channel:
            # Join a specific channel group
            await self.channel_layer.group_add(
                channel,
                self.channel_name
            )
            await self.send_json({
                'type': 'subscribed',
                'channel': channel,
                'message': f'Subscribed to {channel}'
            })
    
    async def _handle_message(self, data):
        """
        Handle generic messages. Override in child classes.
        """
        # Log unknown message type
        logger.debug(f"Unknown message type: {data.get('type')}")
        await self.send_json({
            'type': 'error',
            'message': f"Unknown message type: {data.get('type')}"
        })
    
    async def send_json(self, content):
        """Send JSON data to client."""
        await self.send(text_data=json.dumps(content))
    
    def _start_idle_check(self):
        """Start the idle timeout check task."""
        self._idle_check_task = asyncio.create_task(self._idle_check_loop())
    
    async def _idle_check_loop(self):
        """
        Background task to check for idle connections.
        """
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds
            
            if self.last_activity:
                idle_seconds = (datetime.now() - self.last_activity).total_seconds()
                if idle_seconds > RATE_LIMIT_CONFIG['idle_timeout_seconds']:
                    logger.info(
                        f"Closing idle connection: user={self.user_id}, "
                        f"idle={idle_seconds:.0f}s, timeout={RATE_LIMIT_CONFIG['idle_timeout_seconds']}s"
                    )
                    await self.send_json({
                        'type': 'idle_timeout',
                        'message': 'Connection closed due to inactivity',
                        'idle_seconds': int(idle_seconds)
                    })
                    await self.close(code=CLOSE_CODE_IDLE_TIMEOUT)
                    break


# ============================================================
# LEADERBOARD CONSUMER WITH THROTTLING
# ============================================================

class LeaderboardConsumer(ThrottledWebsocketConsumer):
    """
    WebSocket consumer for real-time leaderboard updates with connection throttling.
    """
    
    async def connect(self):
        """
        Handle leaderboard WebSocket connection with throttling.
        """
        # First run throttling checks
        await super().connect()
        
        # Set up leaderboard group
        self.group_name = "leaderboard"
        
        # Join the leaderboard updates group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
        # Send initial leaderboard data
        await self._send_initial_leaderboard()
        
        logger.info(f"Leaderboard consumer connected: user={self.user_id}")
    
    async def disconnect(self, close_code):
        """
        Handle disconnection from leaderboard.
        """
        # Leave the leaderboard updates group
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        
        # Call parent disconnect
        await super().disconnect(close_code)
    
    async def _handle_message(self, data):
        """
        Handle leaderboard-specific messages.
        """
        action = data.get('action')
        
        if action == 'refresh':
            # Refresh leaderboard data
            await self._send_initial_leaderboard()
        elif action == 'get_top':
            # Get top N users
            limit = data.get('limit', 10)
            await self._send_top_leaderboard(limit)
        else:
            # Pass to parent handler
            await super()._handle_message(data)
    
    async def _send_initial_leaderboard(self):
        """
        Send initial leaderboard data to client.
        """
        # Placeholder - implement actual leaderboard data fetching
        await self.send_json({
            'type': 'leaderboard_data',
            'data': {
                'users': [
                    {'username': 'user1', 'score': 100},
                    {'username': 'user2', 'score': 90},
                    {'username': 'user3', 'score': 80},
                ],
                'user_rank': 1,
                'timestamp': datetime.now().isoformat()
            }
        })
    
    async def _send_top_leaderboard(self, limit: int):
        """
        Send top N leaderboard entries.
        """
        # Placeholder - implement actual top N fetching
        await self.send_json({
            'type': 'top_leaderboard',
            'data': {
                'limit': limit,
                'users': [
                    {'username': f'user{i}', 'score': 100 - i * 10}
                    for i in range(min(limit, 10))
                ],
                'timestamp': datetime.now().isoformat()
            }
        })
    
    # ============================================================
    # GROUP MESSAGE HANDLERS
    # ============================================================
    
    async def leaderboard_update(self, event):
        """
        Receive leaderboard update from group and send to WebSocket.
        """
        await self.send_json({
            'type': 'leaderboard_update',
            'data': event.get('data', {}),
            'timestamp': datetime.now().isoformat()
        })
    
    async def user_rank_update(self, event):
        """
        Receive user rank update from group.
        """
        await self.send_json({
            'type': 'user_rank_update',
            'data': event.get('data', {}),
            'timestamp': datetime.now().isoformat()
        })
    
    async def weekly_reset(self, event):
        """
        Handle weekly leaderboard reset.
        """
        await self.send_json({
            'type': 'weekly_reset',
            'message': 'Leaderboard reset for new week',
            'data': event.get('data', {}),
            'timestamp': datetime.now().isoformat()
        })


# ============================================================
# DASHBOARD CONSUMER (Optional - if you have this)
# ============================================================

class DashboardConsumer(ThrottledWebsocketConsumer):
    """
    WebSocket consumer for real-time dashboard updates.
    """
    
    async def connect(self):
        """Handle dashboard WebSocket connection."""
        # First run throttling checks
        await super().connect()
        
        # Additional dashboard-specific setup
        if self.user_id:
            # Join user-specific group for personalized updates
            await self.channel_layer.group_add(
                f"user_{self.user_id}",
                self.channel_name
            )
            
            # Send initial dashboard data
            await self._send_initial_data()
    
    async def disconnect(self, close_code):
        """Handle disconnection."""
        # Leave user group
        if self.user_id:
            await self.channel_layer.group_discard(
                f"user_{self.user_id}",
                self.channel_name
            )
        
        await super().disconnect(close_code)
    
    async def _handle_message(self, data):
        """Handle dashboard-specific messages."""
        action = data.get('action')
        
        if action == 'refresh':
            # Refresh dashboard data
            await self._send_initial_data()
        elif action == 'subscribe_badge':
            # Subscribe to badge updates
            badge_id = data.get('badge_id')
            if badge_id:
                await self.channel_layer.group_add(
                    f"badge_{badge_id}",
                    self.channel_name
                )
                await self.send_json({
                    'type': 'badge_subscribed',
                    'badge_id': badge_id
                })
        elif action == 'leaderboard':
            # Send leaderboard data
            await self._send_leaderboard()
        else:
            await super()._handle_message(data)
    
    async def _send_initial_data(self):
        """Send initial dashboard data to client."""
        # Placeholder - implement actual data fetching
        await self.send_json({
            'type': 'dashboard_data',
            'data': {
                'user_id': self.user_id,
                'timestamp': datetime.now().isoformat()
            }
        })
    
    async def _send_leaderboard(self):
        """Send leaderboard data."""
        # Placeholder - implement actual leaderboard data
        await self.send_json({
            'type': 'leaderboard',
            'data': {
                'timestamp': datetime.now().isoformat()
            }
        })
    
    # Group update handlers
    async def badge_update(self, event):
        """Handle badge update events from group."""
        await self.send_json({
            'type': 'badge_update',
            'data': event.get('data', {})
        })
    
    async def progress_update(self, event):
        """Handle progress update events."""
        await self.send_json({
            'type': 'progress_update',
            'data': event.get('data', {})
        })