import json
import logging
import os
from datetime import datetime

import redis
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def get_redis_client():
    redis_url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1")
    try:
        # Check if we can connect
        client = redis.from_url(
            redis_url, decode_responses=True, socket_connect_timeout=1
        )
        client.ping()
        return client
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return None


class LeaderboardService:
    ALL_TIME = "leaderboard:all_time"

    @staticmethod
    def get_weekly_key(date=None):
        if date is None:
            date = timezone.now()
        return f"leaderboard:weekly:{date.strftime('%Y_%W')}"

    @staticmethod
    def get_monthly_key(date=None):
        if date is None:
            date = timezone.now()
        return f"leaderboard:monthly:{date.strftime('%Y_%m')}"

    @staticmethod
    def get_seasonal_key(season_name):
        return f"leaderboard:seasonal:{season_name}"

    @staticmethod
    def get_cohort_key(cohort_name):
        return f"leaderboard:cohort:{cohort_name}"

    @staticmethod
    def determine_cohort(date_joined):
        if not date_joined:
            return "unknown"
        year = date_joined.year
        month = date_joined.month
        if 1 <= month <= 3:
            return f"winter_{year}"
        elif 4 <= month <= 6:
            return f"spring_{year}"
        elif 7 <= month <= 9:
            return f"summer_{year}"
        else:
            return f"fall_{year}"

    @classmethod
    def update_user_xp(cls, user_id: int, username: str, xp_delta: int):
        client = get_redis_client()
        if not client:
            return

        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
            cohort = cls.determine_cohort(user.date_joined)
        except User.DoesNotExist:
            cohort = "unknown"

        pipeline = client.pipeline()
        pipeline.hset("leaderboard:users", username, user_id)

        # Update all time
        pipeline.zincrby(cls.ALL_TIME, xp_delta, username)
        # Update weekly
        pipeline.zincrby(cls.get_weekly_key(), xp_delta, username)
        # Update monthly
        pipeline.zincrby(cls.get_monthly_key(), xp_delta, username)
        # Update cohort
        pipeline.zincrby(cls.get_cohort_key(cohort), xp_delta, username)
        # Seasonal logic could be driven by an active season, for now let's assume a default season
        pipeline.zincrby(cls.get_seasonal_key("summer_2026"), xp_delta, username)

        results = pipeline.execute()

        new_xp_all_time = results[1]

        # Broadcast via WebSockets
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "leaderboard",
                {
                    "type": "leaderboard_update",
                    "event": "xp_update",
                    "user_id": user_id,
                    "username": username,
                    "xp": new_xp_all_time,
                    "message": f"User {username} gained XP",
                },
            )

    @classmethod
    def get_leaderboard(
        cls, time_period="all_time", page=1, limit=50, search_username=None
    ):
        from django.core.cache import cache

        cache_key = (
            f"hof_cache:{time_period}:p{page}:l{limit}:u{search_username or 'none'}"
        )
        cached_result = cache.get(cache_key)
        if cached_result:
            return cached_result

        client = get_redis_client()
        if not client:
            return {"total_users": 0, "leaderboard": []}

        if time_period == "weekly":
            key = cls.get_weekly_key()
        elif time_period == "monthly":
            key = cls.get_monthly_key()
        elif time_period.startswith("seasonal"):
            key = cls.get_seasonal_key("summer_2026")
        elif time_period.startswith("cohort_"):
            # e.g., cohort_summer_2026 -> summer_2026
            cohort_name = time_period.replace("cohort_", "")
            key = cls.get_cohort_key(cohort_name)
        else:
            key = cls.ALL_TIME

        if search_username:
            rank = client.zrevrank(key, search_username)
            if rank is not None:
                score = client.zscore(key, search_username)
                result = {
                    "total_users": client.zcard(key),
                    "leaderboard": [
                        {
                            "username": search_username,
                            "rank": rank + 1,
                            "xp": score,
                            "is_top_3": rank < 3,
                        }
                    ],
                }
                cache.set(cache_key, result, timeout=300)
                return result
            result = {"total_users": client.zcard(key), "leaderboard": []}
            cache.set(cache_key, result, timeout=300)
            return result

        start = (page - 1) * limit
        end = start + limit - 1

        results = client.zrevrange(key, start, end, withscores=True)
        total_users = client.zcard(key)

        leaderboard = []
        for i, (username, score) in enumerate(results):
            rank = start + i + 1
            leaderboard.append(
                {"username": username, "rank": rank, "xp": score, "is_top_3": rank <= 3}
            )

        result = {"total_users": total_users, "leaderboard": leaderboard}
        cache.set(cache_key, result, timeout=300)
        return result

    @classmethod
    def get_user_rank(cls, username: str, time_period="all_time"):
        from django.core.cache import cache

        cache_key = f"hof_user_rank:{time_period}:u{username}"
        cached_rank = cache.get(cache_key)
        if cached_rank:
            return cached_rank

        client = get_redis_client()
        if not client:
            return None

        if time_period == "weekly":
            key = cls.get_weekly_key()
        elif time_period == "monthly":
            key = cls.get_monthly_key()
        elif time_period.startswith("seasonal"):
            key = cls.get_seasonal_key("summer_2026")
        elif time_period.startswith("cohort_"):
            cohort_name = time_period.replace("cohort_", "")
            key = cls.get_cohort_key(cohort_name)
        else:
            key = cls.ALL_TIME

        rank = client.zrevrank(key, username)
        if rank is not None:
            score = client.zscore(key, username)
            result = {
                "username": username,
                "rank": rank + 1,
                "xp": score,
                "is_top_3": rank < 3,
            }
            cache.set(cache_key, result, timeout=300)
            return result
        return None

    @classmethod
    def archive_and_reset_monthly_leaderboard(cls, target_date=None):
        """
        Snapshots monthly XP ranks into LeaderboardArchive and resets the monthly Redis XP counter,
        while leaving lifetime XP (leaderboard:all_time and XPEvent) untouched.
        """
        from datetime import timedelta

        from django.contrib.auth import get_user_model
        from django.core.cache import cache

        from apps.progress.models import LeaderboardArchive

        User = get_user_model()
        now = timezone.now()

        # If target_date is not provided, check if today is 1st of month -> target previous month
        if target_date is None:
            if now.day == 1:
                target_date = now - timedelta(days=1)
            else:
                target_date = now

        year = target_date.year
        month = target_date.month
        month_key = f"{year}_{month:02d}"
        redis_monthly_key = cls.get_monthly_key(target_date)

        client = get_redis_client()
        archived_count = 0

        if client:
            # Fetch all user scores for the monthly key
            user_scores = client.zrevrange(redis_monthly_key, 0, -1, withscores=True)
            for idx, (username, score) in enumerate(user_scores):
                rank = idx + 1
                try:
                    user = User.objects.get(username=username)
                    LeaderboardArchive.objects.update_or_create(
                        user=user,
                        year=year,
                        month=month,
                        defaults={
                            "month_key": month_key,
                            "rank": rank,
                            "monthly_xp": int(score),
                        },
                    )
                    archived_count += 1
                except User.DoesNotExist:
                    logger.warning(
                        "User %s not found during monthly leaderboard archive", username
                    )

            # Reset monthly user XP counters in Redis while leaving ALL_TIME intact
            client.delete(redis_monthly_key)

        # Clear cached monthly leaderboard entries
        try:
            cache.delete_pattern("hof_cache:monthly*")
            cache.delete_pattern("hof_user_rank:monthly*")
        except Exception:
            pass

        logger.info(
            "Archived %d entries for monthly leaderboard %s and reset monthly counters",
            archived_count,
            month_key,
        )
        return {"period": month_key, "archived_count": archived_count}
