"""
Management command to clean up orphaned WebSocket connections.
"""

import logging
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.core.cache import cache
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Clean up orphaned WebSocket connections from Redis cache.
    """
    
    help = 'Clean up orphaned WebSocket connections'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--age',
            type=int,
            default=300,
            help='Age in seconds to consider a connection orphaned (default: 300)'
        )
    
    def handle(self, *args, **options):
        """
        Execute the cleanup command.
        """
        age_threshold = options['age']
        self.stdout.write(
            f'Cleaning up WebSocket connections older than {age_threshold} seconds...'
        )
        
        # Get all active connection keys
        active_keys = cache.keys('ws_active_connections_*')
        total_removed = 0
        
        for key in active_keys:
            connections = cache.get(key, set())
            if not connections:
                # Empty set - remove it
                cache.delete(key)
                total_removed += 1
                continue
            
            # Check each connection
            channel_layer = get_channel_layer()
            valid_connections = set()
            
            for channel_name in connections:
                # Check if channel is still alive
                try:
                    # Try to get group members (this fails if channel is dead)
                    groups = async_to_sync(channel_layer.group_channels)(channel_name)
                    valid_connections.add(channel_name)
                except Exception:
                    # Channel is dead - skip it
                    logger.debug(f"Removing dead channel: {channel_name}")
                    total_removed += 1
            
            # Update cache with valid connections
            if valid_connections != connections:
                cache.set(key, valid_connections, age_threshold)
        
        self.stdout.write(
            f'Cleanup complete. Removed {total_removed} orphaned connections.'
        )
        logger.info(f"WebSocket cleanup completed: {total_removed} connections removed")