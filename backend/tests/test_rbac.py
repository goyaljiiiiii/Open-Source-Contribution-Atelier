"""
Tests for RBAC system.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APIClient
from apps.rbac.models import Role, Permission, UserRoleAssignment
from apps.rbac.permissions import Permissions, ROLE_PERMISSIONS, has_permission


class RBACTest(TestCase):
    """
    Test RBAC functionality.
    """
    
    def setUp(self):
        """Set up test data."""
        # Initialize roles and permissions
        call_command('init_roles')
        
        # Create test users
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass',
            is_superuser=True
        )
        
        self.moderator_user = User.objects.create_user(
            username='moderator',
            password='modpass'
        )
        
        self.mentor_user = User.objects.create_user(
            username='mentor',
            password='mentorpass'
        )
        
        self.contributor_user = User.objects.create_user(
            username='contributor',
            password='contribpass'
        )
        
        self.viewer_user = User.objects.create_user(
            username='viewer',
            password='viewerpass'
        )
        
        self.regular_user = User.objects.create_user(
            username='regular',
            password='regularpass'
        )
        
        # Assign roles
        self._assign_role(self.moderator_user, 'moderator')
        self._assign_role(self.mentor_user, 'mentor')
        self._assign_role(self.contributor_user, 'contributor')
        self._assign_role(self.viewer_user, 'viewer')
        
        # Setup API client
        self.client = APIClient()
    
    def _assign_role(self, user, role_name):
        """Helper to assign role to user."""
        role = Role.objects.get(name=role_name)
        UserRoleAssignment.objects.create(
            user=user,
            role=role
        )
    
    def test_permissions_initialized(self):
        """Test that all permissions are initialized."""
        permission_count = len(Permissions)
        self.assertEqual(
            Permission.objects.count(),
            permission_count
        )
    
    def test_roles_created(self):
        """Test that all roles are created."""
        role_names = ['admin', 'moderator', 'mentor', 'contributor', 'viewer']
        for name in role_names:
            self.assertTrue(Role.objects.filter(name=name).exists())
    
    def test_role_permissions(self):
        """Test that roles have correct permissions."""
        for role_name, permission_codenames in ROLE_PERMISSIONS.items():
            role = Role.objects.get(name=role_name)
            role_permissions = role.permissions.values_list('codename', flat=True)
            
            # Check that role has all expected permissions
            for permission in permission_codenames:
                self.assertIn(permission, role_permissions)
    
    def test_has_permission(self):
        """Test has_permission helper."""
        # Admin should have all permissions
        self.assertTrue(
            has_permission(self.admin_user, Permissions.VIEW_CONTENT.value)
        )
        self.assertTrue(
            has_permission(self.admin_user, Permissions.MANAGE_SYSTEM.value)
        )
        
        # Moderator should have moderation permissions
        self.assertTrue(
            has_permission(self.moderator_user, Permissions.APPROVE_BADGES.value)
        )
        self.assertFalse(
            has_permission(self.moderator_user, Permissions.MANAGE_SYSTEM.value)
        )
        
        # Regular user should not have special permissions
        self.assertFalse(
            has_permission(self.regular_user, Permissions.VIEW_ANALYTICS.value)
        )
    
    def test_api_permission_denied(self):
        """Test API returns 403 for unauthorized access."""
        self.client.force_authenticate(user=self.viewer_user)
        
        # Try to access admin-only endpoint
        response = self.client.get('/api/rbac/users/')
        
        # Should return 403
        self.assertEqual(response.status_code, 403)
    
    def test_admin_api_access(self):
        """Test admin can access all endpoints."""
        self.client.force_authenticate(user=self.admin_user)
        
        response = self.client.get('/api/rbac/roles/')
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get('/api/rbac/permissions/')
        self.assertEqual(response.status_code, 200)
    
    def test_role_assignment(self):
        """Test assigning role to user."""
        self.client.force_authenticate(user=self.admin_user)
        
        role = Role.objects.get(name='contributor')
        user = User.objects.create_user(
            username='newuser',
            password='newpass'
        )
        
        response = self.client.post(
            '/api/rbac/assignments/',
            {
                'user': user.id,
                'role': role.id
            }
        )
        
        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            UserRoleAssignment.objects.filter(
                user=user,
                role=role,
                is_active=True
            ).exists()
        )
    
    def test_role_revocation(self):
        """Test revoking role from user."""
        self.client.force_authenticate(user=self.admin_user)
        
        assignment = UserRoleAssignment.objects.filter(
            user=self.moderator_user,
            role__name='moderator'
        ).first()
        
        response = self.client.post(
            f'/api/rbac/assignments/{assignment.id}/revoke/'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Refresh assignment
        assignment.refresh_from_db()
        self.assertFalse(assignment.is_active)