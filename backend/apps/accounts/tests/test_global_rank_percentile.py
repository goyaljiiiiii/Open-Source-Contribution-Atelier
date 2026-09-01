import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.serializers import UserListSerializer
from apps.progress.models import XPEvent
from apps.progress.services.ranking_service import RankingService

User = get_user_model()


@pytest.mark.django_db
class TestGlobalRankPercentileStanding:
    def setup_method(self):
        self.user1 = User.objects.create_user(username="lead_dev", password="password")
        self.user2 = User.objects.create_user(username="mid_dev", password="password")
        self.user3 = User.objects.create_user(
            username="junior_dev", password="password"
        )
        self.user4 = User.objects.create_user(
            username="newbie_dev", password="password"
        )

        # Award XP:
        # user1: 1000 XP (Rank 1)
        # user2: 500 XP (Rank 2)
        # user3: 200 XP (Rank 3)
        # user4: 50 XP (Rank 4)
        XPEvent.objects.create(
            user=self.user1,
            source_type="bonus",
            source_id=1,
            base_points=1000,
            multiplier=1.0,
            xp_delta=1000,
        )
        XPEvent.objects.create(
            user=self.user2,
            source_type="bonus",
            source_id=2,
            base_points=500,
            multiplier=1.0,
            xp_delta=500,
        )
        XPEvent.objects.create(
            user=self.user3,
            source_type="bonus",
            source_id=3,
            base_points=200,
            multiplier=1.0,
            xp_delta=200,
        )
        XPEvent.objects.create(
            user=self.user4,
            source_type="bonus",
            source_id=4,
            base_points=50,
            multiplier=1.0,
            xp_delta=50,
        )

    def test_global_rank_calculation(self):
        s1 = UserListSerializer(self.user1).data
        assert s1["global_rank"] == 1

        s2 = UserListSerializer(self.user2).data
        assert s2["global_rank"] == 2

        s3 = UserListSerializer(self.user3).data
        assert s3["global_rank"] == 3

        s4 = UserListSerializer(self.user4).data
        assert s4["global_rank"] == 4

    def test_percentile_standing_calculation(self):
        # 4 total users:
        # user1: 1/4 = 25%
        # user2: 2/4 = 50%
        # user3: 3/4 = 75%
        # user4: 4/4 = 100%
        s1 = UserListSerializer(self.user1).data
        assert s1["percentile_standing"] <= 25

        s2 = UserListSerializer(self.user2).data
        assert s2["percentile_standing"] <= 50

        s3 = UserListSerializer(self.user3).data
        assert s3["percentile_standing"] <= 75

        s4 = UserListSerializer(self.user4).data
        assert s4["percentile_standing"] <= 100

    def test_single_user_percentile_fallback(self):
        solo_user = User.objects.create_user(
            username="solo_contributor", password="password"
        )
        s = UserListSerializer(solo_user).data
        assert s["percentile_standing"] >= 1

    def test_tied_xp_rank_handling(self):
        tie_user_a = User.objects.create_user(username="tie_a", password="password")
        tie_user_b = User.objects.create_user(username="tie_b", password="password")
        XPEvent.objects.create(
            user=tie_user_a,
            source_type="bonus",
            source_id=10,
            base_points=300,
            multiplier=1.0,
            xp_delta=300,
        )
        XPEvent.objects.create(
            user=tie_user_b,
            source_type="bonus",
            source_id=11,
            base_points=300,
            multiplier=1.0,
            xp_delta=300,
        )

        data_a = UserListSerializer(tie_user_a).data
        data_b = UserListSerializer(tie_user_b).data
        assert data_a["global_rank"] == data_b["global_rank"]

    def test_public_profile_endpoint_includes_rank_fields(self):
        client = APIClient()
        res = client.get(f"/api/auth/profile/{self.user1.username}/")
        assert res.status_code == 200
        assert "global_rank" in res.data
        assert "percentile_standing" in res.data
        assert res.data["global_rank"] == 1
        assert res.data["percentile_standing"] <= 25

    def test_ranking_service_matches_serializer_output(self):
        for user in (self.user1, self.user2, self.user3, self.user4):
            serialized = UserListSerializer(user).data
            assert serialized["global_rank"] == RankingService.get_global_rank(user)
            assert serialized[
                "percentile_standing"
            ] == RankingService.get_percentile_standing(user)
