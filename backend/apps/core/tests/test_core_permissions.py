import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.views import APIView

from apps.core.permissions import (
    HasAnyPermission,
    HasAnyRole,
    HasPermission,
    HasRole,
    HasValidApiKey,
    IsAdminOrModeratorRole,
    IsAdminOrOwner,
    IsAdminRole,
    IsLessonUnlocked,
    IsMembershipOrgAdminOrOwner,
    IsMentor,
    IsModeratorOrAdmin,
    IsModeratorRole,
    IsOrganizationAdminOrOwner,
    IsOrganizationMember,
    IsStaffMember,
    IsTenantMember,
    IsTenantMemberOrReadOnly,
)

User = get_user_model()


class MockObject:
    def __init__(self, user=None, owner=None, actor=None, organization_id=None):
        self.user = user
        self.owner = owner
        self.actor = actor
        self.organization_id = organization_id


class CorePermissionsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.view = APIView()
        self.user = User.objects.create_user(
            username="regular_user", email="user@example.com", password="password"
        )
        self.staff_user = User.objects.create_user(
            username="staff_user",
            email="staff@example.com",
            password="password",
            is_staff=True,
        )
        self.superuser = User.objects.create_superuser(
            username="super_user", email="super@example.com", password="password"
        )

    def test_is_staff_member(self):
        perm = IsStaffMember()

        req_anon = self.factory.get("/")
        req_anon.user = None
        self.assertFalse(perm.has_permission(req_anon, self.view))

        req_user = self.factory.get("/")
        req_user.user = self.user
        self.assertFalse(perm.has_permission(req_user, self.view))

        req_staff = self.factory.get("/")
        req_staff.user = self.staff_user
        self.assertTrue(perm.has_permission(req_staff, self.view))

        req_super = self.factory.get("/")
        req_super.user = self.superuser
        self.assertTrue(perm.has_permission(req_super, self.view))

    def test_is_admin_or_owner(self):
        perm = IsAdminOrOwner()

        req_user = self.factory.get("/")
        req_user.user = self.user
        obj_owned = MockObject(user=self.user)
        obj_other = MockObject(user=self.staff_user)

        self.assertTrue(perm.has_permission(req_user, self.view))
        self.assertTrue(perm.has_object_permission(req_user, self.view, obj_owned))
        self.assertFalse(perm.has_object_permission(req_user, self.view, obj_other))

        req_staff = self.factory.get("/")
        req_staff.user = self.staff_user
        self.assertTrue(perm.has_object_permission(req_staff, self.view, obj_other))

    def test_has_valid_api_key(self):
        perm = HasValidApiKey()

        req_no_key = self.factory.get("/")
        self.assertFalse(perm.has_permission(req_no_key, self.view))

        req_with_key = self.factory.get("/", HTTP_X_API_KEY="test_key_123")
        self.assertTrue(perm.has_permission(req_with_key, self.view))

    def test_is_mentor(self):
        perm = IsMentor()

        req_user = self.factory.get("/")
        req_user.user = self.user
        self.assertFalse(perm.has_permission(req_user, self.view))

        # Attach dummy mentor profile
        self.user.mentor_profile = MockObject()
        self.assertTrue(perm.has_permission(req_user, self.view))

    def test_is_moderator_or_admin(self):
        perm = IsModeratorOrAdmin()

        req_user = self.factory.get("/")
        req_user.user = self.user
        self.assertFalse(perm.has_permission(req_user, self.view))

        req_staff = self.factory.get("/")
        req_staff.user = self.staff_user
        self.assertTrue(perm.has_permission(req_staff, self.view))

    def test_is_admin_role_and_rbac(self):
        perm_admin = IsAdminRole()
        perm_mod = IsModeratorRole()
        perm_admin_mod = IsAdminOrModeratorRole()

        req_super = self.factory.get("/")
        req_super.user = self.superuser

        self.assertTrue(perm_admin.has_permission(req_super, self.view))
        self.assertTrue(perm_admin_mod.has_permission(req_super, self.view))

        req_user = self.factory.get("/")
        req_user.user = self.user
        self.assertFalse(perm_admin.has_permission(req_user, self.view))
        self.assertFalse(perm_mod.has_permission(req_user, self.view))

    def test_has_permission_and_has_role_superuser(self):
        has_perm = HasPermission("some_permission")
        has_role = HasRole("SomeRole")
        has_any_role = HasAnyRole(["RoleA", "RoleB"])
        has_any_perm = HasAnyPermission(["perm_1", "perm_2"])

        req_super = self.factory.get("/")
        req_super.user = self.superuser

        self.assertTrue(has_perm.has_permission(req_super, self.view))
        self.assertTrue(has_role.has_permission(req_super, self.view))
        self.assertTrue(has_any_role.has_permission(req_super, self.view))
        self.assertTrue(has_any_perm.has_permission(req_super, self.view))
