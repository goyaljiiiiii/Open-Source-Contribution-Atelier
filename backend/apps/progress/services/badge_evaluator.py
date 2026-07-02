"""
Badge evaluation service with optimistic locking to prevent race conditions.
"""

import logging
import time
import random
from django.db import transaction, DatabaseError
from django.utils import timezone
from django.db.models import F
from apps.progress.models import UserProgress, Badge, UserBadge

logger = logging.getLogger(__name__)


class BadgeEvaluator:
    """
    Handles badge evaluation with optimistic locking.
    Prevents duplicate badge assignments from concurrent progress updates.
    """
    
    MAX_RETRIES = 3
    BASE_DELAY = 0.1  # 100ms
    
    @classmethod
    def evaluate_with_optimistic_lock(cls, user_id, module_id, progress_data):
        """
        Evaluate badges with optimistic locking to prevent race conditions.
        
        Args:
            user_id: ID of the user
            module_id: ID of the module being updated
            progress_data: Updated progress data (dict)
        
        Returns:
            dict: Status of badge evaluation with awarded badges
        
        Raises:
            Exception: If evaluation fails after max retries
        """
        for attempt in range(cls.MAX_RETRIES):
            try:
                result = cls._evaluate_badges_transaction(
                    user_id, module_id, progress_data
                )
                result['retries'] = attempt
                return result
                
            except DatabaseError as e:
                # Check if this is an optimistic lock conflict
                error_msg = str(e).lower()
                if any(keyword in error_msg for keyword in ['version', 'optimistic lock', 'could not acquire lock']):
                    # Retry with exponential backoff + jitter
                    delay = cls.BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.05)
                    time.sleep(delay)
                    logger.warning(
                        f"Optimistic lock conflict for user {user_id}, "
                        f"module {module_id}, attempt {attempt + 1}/{cls.MAX_RETRIES}"
                    )
                    continue
                raise
                
        raise Exception(
            f"Failed to evaluate badges after {cls.MAX_RETRIES} attempts "
            f"for user {user_id}, module {module_id}"
        )
    
    @classmethod
    @transaction.atomic
    def _evaluate_badges_transaction(cls, user_id, module_id, progress_data):
        """
        Core transaction with version checking.
        
        Uses select_for_update() to lock only the relevant record
        and prevent concurrent modifications.
        """
        # 1. Lock the user progress record using select_for_update()
        try:
            progress = UserProgress.objects.select_for_update(nowait=True).filter(
                user_id=user_id,
                module_id=module_id
            ).first()
        except DatabaseError:
            # Another transaction is holding the lock
            raise DatabaseError("Could not acquire lock - concurrent update in progress")
        
        # 2. Create new record if it doesn't exist
        if not progress:
            progress = UserProgress.objects.create(
                user_id=user_id,
                module_id=module_id,
                progress_data=progress_data
            )
            awarded_badges = cls._evaluate_and_award_badges(user_id, progress)
            return {
                'status': 'created',
                'version': progress.version,
                'badges_awarded': awarded_badges
            }
        
        # 3. Check if progress actually changed (avoid unnecessary writes)
        if progress.progress_data == progress_data:
            logger.info(
                f"No changes detected for user {user_id}, module {module_id}"
            )
            return {
                'status': 'no_change',
                'version': progress.version,
                'badges_awarded': []
            }
        
        # 4. Store current version for verification
        old_version = progress.version
        
        # 5. Update data and increment version atomically
        progress.progress_data = progress_data
        progress.version = F('version') + 1
        progress.save()
        
        # 6. Verify version was incremented correctly (optimistic lock check)
        progress.refresh_from_db()
        if progress.version != old_version + 1:
            raise DatabaseError(
                f"Optimistic lock violation: expected version {old_version + 1}, "
                f"got {progress.version}"
            )
        
        # 7. Evaluate and award badges
        awarded_badges = cls._evaluate_and_award_badges(user_id, progress)
        
        return {
            'status': 'success',
            'version': progress.version,
            'badges_awarded': awarded_badges
        }
    
    @classmethod
    def _evaluate_and_award_badges(cls, user_id, progress):
        """
        Check badge conditions and award new badges.
        
        Args:
            user_id: User to check
            progress: Current UserProgress instance
        
        Returns:
            list: Awarded badge information
        """
        awarded_badges = []
        
        # Get all badges for this module
        try:
            module_badges = Badge.objects.filter(
                module=progress.module,
                is_active=True
            )
        except AttributeError:
            # Module might not be set up in the model
            logger.warning(f"No badges found for module {progress.module_id}")
            return []
        
        for badge in module_badges:
            # Check if conditions are met
            if cls._check_badge_conditions(user_id, progress, badge):
                # Award badge if not already awarded (atomic)
                user_badge, created = UserBadge.objects.get_or_create(
                    user_id=user_id,
                    badge=badge,
                    defaults={'awarded_at': timezone.now()}
                )
                if created:
                    awarded_badges.append({
                        'badge_id': badge.id,
                        'badge_name': badge.name,
                        'awarded_at': user_badge.awarded_at.isoformat()
                    })
                    logger.info(
                        f"Badge '{badge.name}' (ID: {badge.id}) "
                        f"awarded to user {user_id}"
                    )
        
        return awarded_badges
    
    @classmethod
    def _check_badge_conditions(cls, user_id, progress, badge):
        """
        Check if user meets badge requirements.
        
        Args:
            user_id: User to check
            progress: Current progress record
            badge: Badge to evaluate
        
        Returns:
            bool: Whether conditions are met
        """
        # Based on badge condition type
        condition_type = badge.condition_type
        progress_data = progress.progress_data
        
        if condition_type == 'completion':
            return progress_data.get('completed', False)
        elif condition_type == 'score':
            score = progress_data.get('score', 0)
            return score >= badge.condition_value
        elif condition_type == 'streak':
            return progress_data.get('streak', 0) >= badge.condition_value
        elif condition_type == 'contribution':
            return progress_data.get('contributions', 0) >= badge.condition_value
        elif condition_type == 'quiz':
            return progress_data.get('quiz_score', 0) >= badge.condition_value
        
        # Default: check if completed field is True
        return progress_data.get('completed', False)