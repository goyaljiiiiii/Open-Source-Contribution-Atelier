import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import Lesson
from apps.progress.models import UserNote

User = get_user_model()

@pytest.mark.django_db
def test_lesson_notes_get_and_post():
    user = User.objects.create_user(username="testnoteuser", password="password123")
    lesson = Lesson.objects.create(slug="git-basics", title="Git Basics", content="Learn Git")

    client = APIClient()
    client.force_authenticate(user=user)

    # Initial GET - no note exists yet
    response = client.get(f"/api/lessons/{lesson.slug}/notes")
    assert response.status_code == 200
    assert response.data["content"] == ""

    # POST new note
    post_resp = client.post(f"/api/lessons/{lesson.slug}/notes", {"content": "# My Git Notes\n- item 1"}, format="json")
    assert post_resp.status_code == 200
    assert post_resp.data["content"] == "# My Git Notes\n- item 1"

    # GET after saving
    get_resp = client.get(f"/api/lessons/{lesson.slug}/notes")
    assert get_resp.status_code == 200
    assert get_resp.data["content"] == "# My Git Notes\n- item 1"
