"""
Tests for WebSocket connection throttling and resource limits.
"""

import json
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.core.cache import cache
from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer

from apps.dashboard.consumers import (
    DashboardConsumer,
    RATE_LIMIT_CONFIG,
    ConnectionRateLimiter,
    ConnectionManager
)
from apps.dashboard.routing import application


class WebSocketThrottlingTest(TestCase):
    """
    Test WebSocket connection throttling and resource limits.
    """
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )
        
        # Clear cache before each test
        cache.clear()
    
    async def test_rate_limit_exceeded(self):
        """
        Test that rate limiting blocks excessive connections.
        """
        max_connections = RATE_LIMIT_CONFIG['max_connections_per_minute']
        ip_address = '127.0.0.1'
        
        # Create more connections than allowed
        communicators = []
        for i in range(max_connections + 1):
            communicator = WebsocketCommunicator(
                application,
                f"/ws/dashboard/?token=test&ip={ip_address}"
            )
            connected, _ = await communicator.connect()
            
            if i < max_connections:
                # First max_connections should succeed
                self.assertTrue(connected)
                communicators.append(communicator)
            else:
                # Last connection should be rejected
                self.assertFalse(connected)
        
        # Close all successful connections
        for comm in communicators:
            await comm.disconnect()
    
    async def test_concurrent_connection_limit(self):
        """
        Test that concurrent connection limit is enforced.
        """
        max_concurrent = RATE_LIMIT_CONFIG['max_concurrent_connections']
        
        # Create max connections
        communicators = []
        for i in range(max_concurrent):
            communicator = WebsocketCommunicator(
                application,
                f"/ws/dashboard/?token=test"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            communicators.append(communicator)
        
        # Try one more connection - should be rejected
        extra_communicator = WebsocketCommunicator(
            application,
            f"/ws/dashboard/?token=test"
        )
        connected, _ = await extra_communicator.connect()
        self.assertFalse(connected)
        
        # Close all connections
        for comm in communicators:
            await comm.disconnect()
    
    async def test_idle_timeout(self):
        """
        Test that idle connections are automatically closed.
        """
        # Set short timeout for testing
        with patch.dict(
            RATE_LIMIT_CONFIG,
            {'idle_timeout_seconds': 2}
        ):
            communicator = WebsocketCommunicator(
                application,
                "/ws/dashboard/?token=test"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            
            # Wait for idle timeout
            await asyncio.sleep(3)
            
            # Try to receive data - should be closed
            response = await communicator.receive_from()
            self.assertIsNotNone(response)
            
            # Check that connection was closed
            data = json.loads(response)
            self.assertEqual(data['type'], 'idle_timeout')
            
            await communicator.disconnect()
    
    async def test_ping_pong(self):
        """
        Test that ping/pong messages work correctly.
        """
        communicator = WebsocketCommunicator(
            application,
            "/ws/dashboard/?token=test"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Send ping
        await communicator.send_to(text_data=json.dumps({'type': 'ping'}))
        
        # Receive pong
        response = await communicator.receive_from()
        data = json.loads(response)
        self.assertEqual(data['type'], 'pong')
        
        await communicator.disconnect()
    
    async def test_connection_cleanup(self):
        """
        Test that connections are properly cleaned up.
        """
        communicator = WebsocketCommunicator(
            application,
            "/ws/dashboard/?token=test"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Check active connections count
        active_connections = await ConnectionManager.get_active_connections(self.user.id)
        self.assertEqual(len(active_connections), 1)
        
        # Disconnect
        await communicator.disconnect()
        
        # Check active connections count after disconnect
        active_connections = await ConnectionManager.get_active_connections(self.user.id)
        self.assertEqual(len(active_connections), 0)
    
    async def test_rate_limit_decrement_on_disconnect(self):
        """
        Test that rate limit count is decremented when connection closes.
        """
        ip_address = '127.0.0.1'
        
        # Check initial rate limit count
        key = ConnectionRateLimiter.get_cache_key(self.user.id, ip_address)
        initial_count = cache.get(key, 0)
        self.assertEqual(initial_count, 0)
        
        # Connect
        communicator = WebsocketCommunicator(
            application,
            f"/ws/dashboard/?token=test&ip={ip_address}"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Check rate limit count after connect
        count_after_connect = cache.get(key, 0)
        self.assertEqual(count_after_connect, 1)
        
        # Disconnect
        await communicator.disconnect()
        
        # Check rate limit count after disconnect
        count_after_disconnect = cache.get(key, 0)
        self.assertEqual(count_after_disconnect, 0)
    
    async def test_authentication_required(self):
        """
        Test that authentication is required for WebSocket connections.
        """
        # Try without token
        communicator = WebsocketCommunicator(
            application,
            "/ws/dashboard/"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)  # Anonymous connections allowed
        
        # Check that user is anonymous
        self.assertEqual(
            communicator.scope.get('user'),
            None
        )
        
        await communicator.disconnect()
    
    async def test_subscription_system(self):
        """
        Test that subscription system works.
        """
        communicator = WebsocketCommunicator(
            application,
            "/ws/dashboard/?token=test"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        
        # Subscribe to a channel
        await communicator.send_to(text_data=json.dumps({
            'type': 'subscribe',
            'channel': 'test_channel'
        }))
        
        # Wait for subscription confirmation
        response = await communicator.receive_from()
        data = json.loads(response)
        self.assertEqual(data['type'], 'subscribed')
        self.assertEqual(data['channel'], 'test_channel')
        
        await communicator.disconnect()


class WebSocketStatsTest(TransactionTestCase):
    """
    Test WebSocket statistics and monitoring.
    """
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        cache.clear()
    
    def test_connection_stats(self):
        """
        Test that connection statistics are accurate.
        """
        # Simulate active connections
        for i in range(3):
            user_id = self.user.id + i if i > 0 else self.user.id
            key = ConnectionManager.get_active_connections_key(user_id)
            cache.set(key, {f'channel_{i}'}, 300)
        
        # Get stats
        from apps.dashboard.management.commands.websocket_stats import Command
        command = Command()
        
        # Capture output
        import io
        import sys
        captured_output = io.StringIO()
        sys.stdout = captured_output
        
        command.handle()
        
        # Restore stdout
        sys.stdout = sys.__stdout__
        
        # Check output contains stats
        output = captured_output.getvalue()
        self.assertIn('Total active connections:', output)
        self.assertIn('Active users:', output)
    
    def test_cleanup_command(self):
        """
        Test that cleanup command removes orphaned connections.
        """
        # Create orphaned connection (channel doesn't exist)
        key = ConnectionManager.get_active_connections_key(self.user.id)
        cache.set(key, {'non_existent_channel'}, 300)
        
        # Run cleanup
        from apps.dashboard.management.commands.cleanup_websockets import Command
        command = Command()
        
        import io
        import sys
        captured_output = io.StringIO()
        sys.stdout = captured_output
        
        command.handle()
        
        # Restore stdout
        sys.stdout = sys.__stdout__
        
        # Check that connections were removed
        connections = cache.get(key, set())
        self.assertEqual(len(connections), 0)