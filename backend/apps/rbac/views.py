"""
Views for RBAC management with full CRUD operations,
object-level permissions, and audit logging.
"""

from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied

from .models import Permission, Role, UserRole, AuditLog
from .serializers import (
    PermissionSerializer,
    PermissionListSerializer,
    RoleSerializer,
    RoleListSerializer,
    UserRoleSerializer,
    UserRoleAssignSerializer,
    AuditLogSerializer,
    AuditLogListSerializer,
    UserPermissionsSerializer,
    InitializePermissionsSerializer,
)
from .permissions import (
    HasPermission, 
    HasRole, 
    HasAnyPermission,
    IsSuperUser,
    require_permission,
    require_role
)
from .utils import get_user_permissions, user_has_permission


# ============================================================
# PERMISSION VIEWS
# ============================================================

class PermissionListView(generics.ListAPIView):
    """
    List all permissions.
    """
    queryset = Permission.objects.filter(is_active=True)
    serializer_class = PermissionListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter permissions by category."""
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset


class PermissionDetailView(generics.RetrieveAPIView):
    """
    Retrieve a single permission.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_permissions')]


class PermissionCreateView(generics.CreateAPIView):
    """
    Create a new permission.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_permissions')]
    
    def perform_create(self, serializer):
        permission = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='create',
            permission=permission,
            details=f"Created permission: {permission.slug}"
        )


class PermissionUpdateView(generics.UpdateAPIView):
    """
    Update an existing permission.
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_permissions')]
    
    def perform_update(self, serializer):
        permission = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='update',
            permission=permission,
            details=f"Updated permission: {permission.slug}"
        )


class PermissionDeleteView(generics.DestroyAPIView):
    """
    Delete a permission (soft delete).
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_permissions')]
    
    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='delete',
            permission=instance,
            details=f"Deleted permission: {instance.slug}"
        )


# ============================================================
# ROLE VIEWS
# ============================================================

class RoleListView(generics.ListAPIView):
    """
    List all roles.
    """
    queryset = Role.objects.filter(is_active=True)
    serializer_class = RoleListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Filter roles by name or system role status."""
        queryset = super().get_queryset()
        
        name = self.request.query_params.get('name')
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        is_system_role = self.request.query_params.get('is_system_role')
        if is_system_role is not None:
            queryset = queryset.filter(is_system_role=is_system_role.lower() == 'true')
        
        return queryset


class RoleDetailView(generics.RetrieveAPIView):
    """
    Retrieve a single role with full details.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_roles')]


class RoleCreateView(generics.CreateAPIView):
    """
    Create a new role.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_roles')]
    
    @transaction.atomic
    def perform_create(self, serializer):
        role = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='create',
            role=role,
            details=f"Created role: {role.name}"
        )


class RoleUpdateView(generics.UpdateAPIView):
    """
    Update an existing role.
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_roles')]
    
    @transaction.atomic
    def perform_update(self, serializer):
        role = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='update',
            role=role,
            details=f"Updated role: {role.name}"
        )


class RoleDeleteView(generics.DestroyAPIView):
    """
    Delete a role (soft delete).
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermission('manage_roles')]
    
    def perform_destroy(self, instance):
        # Don't allow deleting system roles
        if instance.is_system_role:
            raise PermissionDenied("Cannot delete system roles.")
        
        instance.is_active = False
        instance.save()
        AuditLog.objects.create(
            actor=self.request.user,
            target_user=self.request.user,
            action='delete',
            role=instance,
            details=f"Deleted role: {instance.name}"
        )


class RoleAssignPermissionsView(APIView):
    """
    Assign permissions to a role.
    """
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('manage_roles')
    ]
    
    def post(self, request, role_id):
        role = get_object_or_404(Role, id=role_id)
        permission_ids = request.data.get('permission_ids', [])
        
        if not permission_ids:
            return Response(
                {'error': 'permission_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        permissions_list = Permission.objects.filter(id__in=permission_ids)
        role.permissions.set(permissions_list)
        
        AuditLog.objects.create(
            actor=request.user,
            target_user=request.user,
            action='assign',
            role=role,
            details=f"Assigned {len(permissions_list)} permissions to role {role.name}"
        )
        
        return Response({
            'status': 'Permissions assigned',
            'permissions_count': permissions_list.count()
        }, status=status.HTTP_200_OK)


# ============================================================
# USER ROLE ASSIGNMENT VIEWS
# ============================================================

class AssignRoleView(APIView):
    """
    Assign a role to a user.
    """
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('assign_roles')
    ]
    
    @transaction.atomic
    def post(self, request):
        target_user_id = request.data.get("user_id")
        role_id = request.data.get("role_id")
        organization_id = request.data.get("organization_id", None)
        expires_at = request.data.get("expires_at", None)
        
        # Validate inputs
        try:
            target_user = User.objects.get(id=target_user_id)
            role = Role.objects.get(id=role_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Role.DoesNotExist:
            return Response(
                {"error": "Role not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if assignment already exists
        if UserRole.objects.filter(
            user=target_user,
            role=role,
            organization_id=organization_id,
            is_active=True
        ).exists():
            return Response(
                {"status": "User already has this role"},
                status=status.HTTP_200_OK
            )
        
        # Create assignment
        user_role = UserRole.objects.create(
            user=target_user,
            role=role,
            organization_id=organization_id,
            assigned_by=request.user,
            expires_at=expires_at
        )
        
        # Audit log
        AuditLog.objects.create(
            actor=request.user,
            target_user=target_user,
            action="assign",
            role=role,
            organization_id=organization_id,
            details=f"Assigned role {role.name} to {target_user.username}"
        )
        
        serializer = UserRoleSerializer(user_role, context={'request': request})
        return Response(
            {
                "status": "Role assigned successfully",
                "assignment": serializer.data
            },
            status=status.HTTP_201_CREATED
        )


class BulkAssignRolesView(APIView):
    """
    Assign roles to multiple users in bulk.
    """
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('assign_roles')
    ]
    
    @transaction.atomic
    def post(self, request):
        serializer = UserRoleAssignSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = serializer.validated_data
        user_ids = data['user_ids']
        role_id = data['role_id']
        organization_id = data.get('organization_id')
        expires_at = data.get('expires_at')
        
        # Get role
        try:
            role = Role.objects.get(id=role_id, is_active=True)
        except Role.DoesNotExist:
            return Response(
                {"error": "Role not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get users
        users = User.objects.filter(id__in=user_ids)
        
        assignments = []
        for user in users:
            # Check if assignment exists
            if not UserRole.objects.filter(
                user=user,
                role=role,
                organization_id=organization_id,
                is_active=True
            ).exists():
                user_role = UserRole.objects.create(
                    user=user,
                    role=role,
                    organization_id=organization_id,
                    assigned_by=request.user,
                    expires_at=expires_at
                )
                assignments.append(user_role)
                
                # Audit log
                AuditLog.objects.create(
                    actor=request.user,
                    target_user=user,
                    action="assign",
                    role=role,
                    organization_id=organization_id,
                    details=f"Assigned role {role.name} to {user.username} (bulk)"
                )
        
        return Response({
            "status": f"Role assigned to {len(assignments)} users",
            "assignments_count": len(assignments)
        }, status=status.HTTP_201_CREATED)


class RevokeRoleView(APIView):
    """
    Revoke a role from a user.
    """
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('assign_roles')
    ]
    
    @transaction.atomic
    def post(self, request):
        target_user_id = request.data.get("user_id")
        role_id = request.data.get("role_id")
        organization_id = request.data.get("organization_id", None)
        
        try:
            user_role = UserRole.objects.get(
                user_id=target_user_id,
                role_id=role_id,
                organization_id=organization_id,
                is_active=True
            )
        except UserRole.DoesNotExist:
            return Response(
                {"error": "Role assignment not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Revoke the role
        user_role.revoke(revoked_by=request.user)
        
        # Audit log
        AuditLog.objects.create(
            actor=request.user,
            target_user=user_role.user,
            action="revoke",
            role=user_role.role,
            organization_id=organization_id,
            details=f"Revoked role {user_role.role.name} from {user_role.user.username}"
        )
        
        return Response(
            {"status": "Role revoked successfully"},
            status=status.HTTP_200_OK
        )


class UserRolesView(generics.ListAPIView):
    """
    List all roles assigned to a user.
    """
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        user = get_object_or_404(User, id=user_id)
        
        # Users can view their own roles, admins can view any
        if self.request.user.id != user_id and not self.request.user.is_superuser:
            raise PermissionDenied("You can only view your own roles.")
        
        return UserRole.objects.filter(
            user=user,
            is_active=True
        ).select_related('role', 'organization')


class MyRolesView(generics.ListAPIView):
    """
    List roles for the currently authenticated user.
    """
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return UserRole.objects.filter(
            user=self.request.user,
            is_active=True
        ).select_related('role', 'organization')


class MyPermissionsView(APIView):
    """
    Get all permissions for the currently authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        permissions = get_user_permissions(request.user)
        
        # Also get role information
        roles = request.user.user_roles.filter(is_active=True).select_related('role')
        
        return Response({
            'user_id': request.user.id,
            'username': request.user.username,
            'is_superuser': request.user.is_superuser,
            'permissions': permissions,
            'roles': [
                {
                    'name': ur.role.name,
                    'display_name': ur.role.display_name,
                    'organization': ur.organization.name if ur.organization else None,
                }
                for ur in roles
            ]
        })


# ============================================================
# USER PERMISSIONS VIEW (Admin)
# ============================================================

class UserPermissionsView(APIView):
    """
    Get all permissions for a specific user (Admin only).
    """
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('view_users')
    ]
    
    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        serializer = UserPermissionsSerializer(user)
        return Response(serializer.data)


# ============================================================
# AUDIT LOG VIEWS
# ============================================================

class AuditLogListView(generics.ListAPIView):
    """
    List all audit logs with filtering.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogListSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('view_audit_logs')
    ]
    
    def get_queryset(self):
        """Filter audit logs."""
        queryset = super().get_queryset()
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(target_user_id=user_id)
        
        # Filter by actor
        actor_id = self.request.query_params.get('actor_id')
        if actor_id:
            queryset = queryset.filter(actor_id=actor_id)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by role
        role_id = self.request.query_params.get('role_id')
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        
        return queryset


class AuditLogDetailView(generics.RetrieveAPIView):
    """
    Retrieve a single audit log entry.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        HasPermission('view_audit_logs')
    ]


# ============================================================
# INITIALIZE PERMISSIONS VIEW
# ============================================================

class InitializePermissionsView(APIView):
    """
    Initialize all permissions and roles (Admin only).
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]
    
    @transaction.atomic
    def post(self, request):
        serializer = InitializePermissionsSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .management.commands.init_roles import Command
            command = Command()
            command.handle()
            
            return Response({
                'status': 'Permissions and roles initialized successfully'
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({
                'error': f'Failed to initialize: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
# PERMISSION CHECK VIEWS (for frontend)
# ============================================================

class CheckPermissionView(APIView):
    """
    Check if the current user has a specific permission.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        permission = request.query_params.get('permission')
        
        if not permission:
            return Response({
                'error': 'permission parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        has_perm = user_has_permission(request.user, permission)
        
        return Response({
            'permission': permission,
            'has_permission': has_perm
        })


class CheckRoleView(APIView):
    """
    Check if the current user has a specific role.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        role_name = request.query_params.get('role')
        
        if not role_name:
            return Response({
                'error': 'role parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        has_role = request.user.user_roles.filter(
            role__name=role_name,
            is_active=True
        ).exists()
        
        return Response({
            'role': role_name,
            'has_role': has_role or request.user.is_superuser
        })