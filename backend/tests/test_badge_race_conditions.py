"""
Tests for badge race conditions and optimistic locking.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.db import DatabaseError
from django.utils import timezone
import concurrent.futures
import time

from apps.progress.models import UserProgress, Badge, UserBadge
from apps.content.models import Module
from apps.progress.services.badge_evaluator import BadgeEvaluator


class BadgeRaceConditionTest(TestCase):
    """
    Test badge evaluation under concurrent updates.
    """
    
    def setUp(self):
        """Set up test data."""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com'
        )
        
        # Create test module
        self.module = Module.objects.create(
            name='Test Module',
            description='Module for testing'
        )
        
        # Create test badge
        self.badge = Badge.objects.create(
            name='Test Badge',
            description='Awarded for completing test module',
            module=self.module,
            condition_type='completion',
            condition_value=1,
            is_active=True
        )
    
    def test_multiple_concurrent_updates_single_badge(self):
        """
        Test that 10 concurrent updates from same user result in only 1 badge.
        """
        def update_progress(iteration):
            """Simulate a concurrent progress update."""
            data = {
                'completed': True,
                'score': 100,
                'iteration': iteration,
                'timestamp': time.time()
            }
            return BadgeEvaluator.evaluate_with_optimistic_lock(
                user_id=self.user.id,
                module_id=self.module.id,
                progress_data=data
            )
        
        # Launch 10 concurrent updates
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(update_progress, i)
                for i in range(10)
            ]
            results = [f.result() for f in futures]
        
        # Check results
        created_results = [r for r in results if r.get('status') == 'created']
        
        # Only one should create
        self.assertLessEqual(len(created_results), 1,
            f"Expected at most 1 created, got {len(created_results)}")
        
        # Verify only ONE badge was awarded
        user_badges = UserBadge.objects.filter(
            user=self.user,
            badge=self.badge
        )
        self.assertEqual(
            user_badges.count(), 1,
            f"Expected 1 badge, got {user_badges.count()}"
        )
    
    def test_optimistic_lock_conflict_detected(self):
        """
        Test that optimistic lock conflicts are detected and handled.
        """
        # First, create a progress record
        BadgeEvaluator.evaluate_with_optimistic_lock(
            user_id=self.user.id,
            module_id=self.module.id,
            progress_data={'completed': False, 'score': 0}
        )
        
        def fast_update():
            """Simulate a fast update."""
            return BadgeEvaluator.evaluate_with_optimistic_lock(
                user_id=self.user.id,
                module_id=self.module.id,
                progress_data={'completed': True, 'score': 100}
            )
        
        # Launch multiple concurrent updates
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(fast_update) for _ in range(5)]
            results = [f.result() for f in futures]
        
        # At least some should have retries
        retry_count = sum([
            1 for r in results
            if r.get('retries', 0) > 0
        ])
        self.assertGreaterEqual(retry_count, 1,
            "Expected at least one retry due to lock conflicts")
        
        # Still only one badge awarded
        user_badges = UserBadge.objects.filter(
            user=self.user,
            badge=self.badge
        )
        self.assertEqual(user_badges.count(), 1,
            "Concurrent updates should only award badge once")