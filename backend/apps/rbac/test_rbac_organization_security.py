from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserProfile
from apps.organizations.models import Organization, OrganizationMembership
from apps.rbac.models import Permission, Role, UserRole

User = get_user_model()


class RBACAddOrganizationSecurityTests(APITestCase):
    def setUp(self):
        self.org_1 = Organization.objects.create(name="Org 1")
        self.org_2 = Organization.objects.create(name="Org 2")

        # Create role & permission for manage_roles
        self.manage_roles_perm = Permission.objects.create(
            slug="manage_roles", description="Manage roles permission"
        )
        self.admin_role = Role.objects.create(name="OrgAdmin")
        self.admin_role.permissions.add(self.manage_roles_perm)

        self.member_role = Role.objects.create(name="MemberRole")

        # Admin in Org 1
        self.admin_org1 = User.objects.create_user(
            username="admin_org1", password="password123"
        )
        profile_admin, _ = UserProfile.objects.get_or_create(user=self.admin_org1)
        profile_admin.organization = self.org_1
        profile_admin.save()
        OrganizationMembership.objects.create(
            organization=self.org_1, user=self.admin_org1, role="admin"
        )
        UserRole.objects.create(
            user=self.admin_org1, role=self.admin_role, organization=self.org_1
        )

        # Target user in Org 1
        self.user_org1 = User.objects.create_user(
            username="user_org1", password="password123"
        )
        profile_user1, _ = UserProfile.objects.get_or_create(user=self.user_org1)
        profile_user1.organization = self.org_1
        profile_user1.save()
        OrganizationMembership.objects.create(
            organization=self.org_1, user=self.user_org1, role="member"
        )

        # Target user in Org 2
        self.user_org2 = User.objects.create_user(
            username="user_org2", password="password123"
        )
        profile_user2, _ = UserProfile.objects.get_or_create(user=self.user_org2)
        profile_user2.organization = self.org_2
        profile_user2.save()
        OrganizationMembership.objects.create(
            organization=self.org_2, user=self.user_org2, role="member"
        )

        # Superuser
        self.superuser = User.objects.create_superuser(
            username="super_admin", email="super@example.com", password="password123"
        )

    def test_assign_role_same_organization_allowed(self):
        """Admin in Org 1 assigning role to user in Org 1 should succeed."""
        self.client.force_authenticate(user=self.admin_org1)
        data = {
            "user_id": self.user_org1.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_1.id,
        }
        response = self.client.post("/api/rbac/assign/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            UserRole.objects.filter(
                user=self.user_org1, role=self.member_role, organization=self.org_1
            ).exists()
        )

    def test_assign_role_cross_organization_admin_forbidden(self):
        """Admin in Org 1 assigning role in Org 2 should be rejected with 403 Forbidden."""
        self.client.force_authenticate(user=self.admin_org1)
        data = {
            "user_id": self.user_org2.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_2.id,
        }
        response = self.client.post("/api/rbac/assign/", data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            UserRole.objects.filter(
                user=self.user_org2, role=self.member_role, organization=self.org_2
            ).exists()
        )

    def test_assign_role_cross_organization_target_user_forbidden(self):
        """Admin in Org 1 trying to assign Org 1 role to user in Org 2 should be rejected with 403."""
        self.client.force_authenticate(user=self.admin_org1)
        data = {
            "user_id": self.user_org2.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_1.id,
        }
        response = self.client.post("/api/rbac/assign/", data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_cross_organization_assign_allowed(self):
        """Superuser should be allowed to assign roles across any organization."""
        self.client.force_authenticate(user=self.superuser)
        data = {
            "user_id": self.user_org2.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_2.id,
        }
        response = self.client.post("/api/rbac/assign/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_revoke_role_same_organization_allowed(self):
        """Admin in Org 1 revoking role for user in Org 1 should succeed."""
        UserRole.objects.create(
            user=self.user_org1, role=self.member_role, organization=self.org_1
        )
        self.client.force_authenticate(user=self.admin_org1)
        data = {
            "user_id": self.user_org1.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_1.id,
        }
        response = self.client.post("/api/rbac/revoke/", data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            UserRole.objects.filter(
                user=self.user_org1, role=self.member_role, organization=self.org_1
            ).exists()
        )

    def test_revoke_role_cross_organization_forbidden(self):
        """Admin in Org 1 revoking role for user in Org 2 should return 403 Forbidden."""
        UserRole.objects.create(
            user=self.user_org2, role=self.member_role, organization=self.org_2
        )
        self.client.force_authenticate(user=self.admin_org1)
        data = {
            "user_id": self.user_org2.id,
            "role_id": self.member_role.id,
            "organization_id": self.org_2.id,
        }
        response = self.client.post("/api/rbac/revoke/", data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
