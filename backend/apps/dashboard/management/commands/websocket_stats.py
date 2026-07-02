"""
Management command to display WebSocket connection statistics.
"""

import logging
from datetime import datetime

from django.core.management.base import BaseCommand
from django.core.cache import cache
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Display WebSocket connection statistics.
    """
    
    help = 'Display WebSocket connection statistics'
    
    def handle(self, *args, **options):
        """
        Display connection statistics.
        """
        self.stdout.write('=' * 60)
        self.stdout.write('WebSocket Connection Statistics')
        self.stdout.write('=' * 60)
        
        # Get all active connection keys
        active_keys = cache.keys('ws_active_connections_*')
        total_connections = 0
        user_stats = {}
        
        for key in active_keys:
            connections = cache.get(key, set())
            total_connections += len(connections)
            
            # Parse user ID from key
            try:
                user_id = int(key.split('_')[-1])
                user_stats[user_id] = len(connections)
            except ValueError:
                pass
        
        self.stdout.write(f'\nTotal active connections: {total_connections}')
        self.stdout.write(f'Active users: {len(user_stats)}')
        
        if user_stats:
            self.stdout.write('\nTop users by connections:')
            sorted_users = sorted(user_stats.items(), key=lambda x: x[1], reverse=True)
            for i, (user_id, count) in enumerate(sorted_users[:10], 1):
                self.stdout.write(f'  {i}. User {user_id}: {count} connections')
        
        # Get rate limit counts
        rate_limit_keys = cache.keys('ws_rate_limit_*')
        rate_limit_stats = {}
        
        for key in rate_limit_keys:
            count = cache.get(key, 0)
            if count > 0:
                rate_limit_stats[key] = count
        
        self.stdout.write(f'\nActive rate limit entries: {len(rate_limit_stats)}')
        if rate_limit_stats:
            self.stdout.write('\nTop rate-limited users/IPs:')
            sorted_limits = sorted(rate_limit_stats.items(), key=lambda x: x[1], reverse=True)
            for i, (key, count) in enumerate(sorted_limits[:5], 1):
                self.stdout.write(f'  {i}. {key}: {count} connections/min')
        
        self.stdout.write('\n' + '=' * 60)