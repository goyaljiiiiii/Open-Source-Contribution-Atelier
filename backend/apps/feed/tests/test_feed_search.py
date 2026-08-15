import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.feed.models import FeedPost

User = get_user_model()


@pytest.mark.django_db
class TestFeedPostSearch:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testsearchuser", password="password123"
        )
        self.client.force_authenticate(user=self.user)

        self.post1 = FeedPost.objects.create(
            author=self.user,
            title="How to configure PostgreSQL full text search in Django?",
            body="I am trying to add full-text indexing on post body and title fields.",
            post_type="question",
        )
        self.post2 = FeedPost.objects.create(
            author=self.user,
            title="Discussion about React 19 state management",
            body="Let us discuss Zustand vs Redux Toolkit vs React Query in modern web apps.",
            post_type="discussion",
        )
        self.post3 = FeedPost.objects.create(
            author=self.user,
            title="Sharing my open source portfolio project",
            body="Here is the repository link for my open-source Atelier platform.",
            post_type="share",
        )

    def test_list_all_feed_posts(self):
        response = self.client.get("/api/feed/posts/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 3

    def test_filter_by_post_type(self):
        response = self.client.get("/api/feed/posts/search/?post_type=question")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == self.post1.id

    def test_search_by_query_text(self):
        response = self.client.get("/api/feed/posts/search/?q=PostgreSQL")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == self.post1.id

    def test_search_and_filter_combined(self):
        response = self.client.get("/api/feed/posts/search/?q=portfolio&post_type=share")
        assert response.status_code == 200
        assert response.data["count"] == 1
        assert response.data["results"][0]["id"] == self.post3.id

    def test_search_no_results(self):
        response = self.client.get("/api/feed/posts/search/?q=nonexistentkw")
        assert response.status_code == 200
        assert response.data["count"] == 0
