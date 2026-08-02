import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.content.models import LearningPath
from apps.rbac.models import Role, UserRole

User = get_user_model()


@pytest.mark.django_db
class TestLearningPathRBAC:
    def setup_method(self):
        self.client = APIClient()

        # Create roles
        self.maintainer_role = Role.objects.create(
            name="Maintainer", description="Maintainer role"
        )
        self.contributor_role = Role.objects.create(
            name="Contributor", description="Contributor role"
        )

        # Create users
        self.regular_user = User.objects.create_user(
            username="regular_user", password="password123"
        )
        self.maintainer_user = User.objects.create_user(
            username="maintainer_user", password="password123"
        )
        UserRole.objects.create(user=self.maintainer_user, role=self.maintainer_role)

        self.staff_user = User.objects.create_user(
            username="staff_user", password="password123", is_staff=True
        )

        # Create learning paths
        self.public_path = LearningPath.objects.create(
            title="Public Open Source Basics",
            slug="public-open-source-basics",
            description="Open to everyone",
            is_published=True,
        )

        self.restricted_path = LearningPath.objects.create(
            title="Advanced Maintainer Workflows",
            slug="advanced-maintainer-workflows",
            description="Restricted to Maintainers",
            is_published=True,
        )
        self.restricted_path.required_roles.add(self.maintainer_role)

    def test_public_path_accessible_by_anyone(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(
            f"/api/content/learning-paths/{self.public_path.id}/"
        )
        assert response.status_code == 200
        assert response.data["title"] == "Public Open Source Basics"
        assert response.data["hasAccess"] is True

    def test_restricted_path_denied_without_role(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(
            f"/api/content/learning-paths/{self.restricted_path.id}/"
        )
        assert response.status_code == 403
        assert "Access restricted by role" in response.data["detail"]

    def test_restricted_path_allowed_with_matching_role(self):
        self.client.force_authenticate(user=self.maintainer_user)
        response = self.client.get(
            f"/api/content/learning-paths/{self.restricted_path.id}/"
        )
        assert response.status_code == 200
        assert response.data["title"] == "Advanced Maintainer Workflows"
        assert response.data["hasAccess"] is True

    def test_restricted_path_allowed_for_staff_user(self):
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get(
            f"/api/content/learning-paths/{self.restricted_path.id}/"
        )
        assert response.status_code == 200
        assert response.data["title"] == "Advanced Maintainer Workflows"

    def test_list_learning_paths_filtering(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get("/api/content/learning-paths/")
        assert response.status_code == 200
        results = (
            response.data
            if isinstance(response.data, list)
            else response.data.get("results", [])
        )
        path_access_map = {
            p["id"]: bool(p.get("hasAccess", p.get("has_access"))) for p in results
        }
        assert path_access_map[self.public_path.id] == True
        assert path_access_map[self.restricted_path.id] == False
