"""
Permission classes for RBAC with support for object-level permissions,
organization scoping, and multiple permission checking strategies.
"""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth.models import User, AnonymousUser
from guardian.shortcuts import get_perms
from typing import Optional, List, Union

from .models import UserRole, Permission, Role
from .utils import user_has_permission, get_user_roles, has_object_permission


class HasPermission(permissions.BasePermission):
    """
    Permission class to check if user has a specific permission.
    
    Usage:
        permission_classes = [HasPermission('view_content')]
    """
    
    def __init__(self, required_permission: str, obj_param: Optional[str] = None, 
                 organization_param: Optional[str] = None):
        """
        Initialize the permission checker.
        
        Args:
            required_permission: Permission slug to check
            obj_param: Optional URL parameter for object-level permission check
            organization_param: Optional URL parameter for organization scope
        """
        self.required_permission = required_permission
        self.obj_param = obj_param
        self.organization_param = organization_param
    
    def has_permission(self, request, view):
        """
        Check if user has the required permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get organization from URL if specified
        organization = None
        if self.organization_param:
            organization = view.kwargs.get(self.organization_param)
        
        # Get object for object-level check if specified
        obj = None
        if self.obj_param:
            obj = view.kwargs.get(self.obj_param)
            if obj:
                # Try to get the actual object if it's an ID
                if isinstance(obj, (int, str)):
                    obj = getattr(view, 'get_object', lambda: None)()
        
        # Check permission using the utility function
        return user_has_permission(
            request.user, 
            self.required_permission,
            organization=organization,
            obj=obj
        )
    
    def has_object_permission(self, request, view, obj):
        """
        Check object-level permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Check if user has the permission on this specific object
        return has_object_permission(request.user, self.required_permission, obj)


class HasRole(permissions.BasePermission):
    """
    Permission class to check if user has a specific role.
    
    Usage:
        permission_classes = [HasRole('admin')]
    """
    
    def __init__(self, required_role: Union[str, List[str]], 
                 organization_param: Optional[str] = None):
        """
        Initialize the role checker.
        
        Args:
            required_role: Single role name or list of role names
            organization_param: Optional URL parameter for organization scope
        """
        if isinstance(required_role, str):
            self.required_roles = [required_role]
        else:
            self.required_roles = required_role
        
        self.organization_param = organization_param
    
    def has_permission(self, request, view):
        """
        Check if user has any of the required roles.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get organization from URL if specified
        organization = None
        if self.organization_param:
            organization = view.kwargs.get(self.organization_param)
        
        # Get user's active roles
        user_roles = get_user_roles(request.user, organization)
        
        # Check if any of the user's roles match the required roles
        for user_role in user_roles:
            if user_role.role.name in self.required_roles:
                return True
        
        return False


class HasAnyPermission(permissions.BasePermission):
    """
    Permission class to check if user has ANY of the specified permissions.
    
    Usage:
        permission_classes = [HasAnyPermission(['view_content', 'edit_content'])]
    """
    
    def __init__(self, required_permissions: List[str], 
                 obj_param: Optional[str] = None,
                 organization_param: Optional[str] = None):
        """
        Initialize the permission checker.
        
        Args:
            required_permissions: List of permission slugs
            obj_param: Optional URL parameter for object-level permission check
            organization_param: Optional URL parameter for organization scope
        """
        self.required_permissions = required_permissions
        self.obj_param = obj_param
        self.organization_param = organization_param
    
    def has_permission(self, request, view):
        """
        Check if user has ANY of the required permissions.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get organization from URL if specified
        organization = None
        if self.organization_param:
            organization = view.kwargs.get(self.organization_param)
        
        # Get object for object-level check if specified
        obj = None
        if self.obj_param:
            obj = view.kwargs.get(self.obj_param)
            if obj and isinstance(obj, (int, str)):
                obj = getattr(view, 'get_object', lambda: None)()
        
        # Check each permission
        for permission in self.required_permissions:
            if user_has_permission(request.user, permission, organization=organization, obj=obj):
                return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """
        Check object-level permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Check each permission on the object
        for permission in self.required_permissions:
            if has_object_permission(request.user, permission, obj):
                return True
        
        return False


class HasAllPermissions(permissions.BasePermission):
    """
    Permission class to check if user has ALL of the specified permissions.
    
    Usage:
        permission_classes = [HasAllPermissions(['view_content', 'edit_content'])]
    """
    
    def __init__(self, required_permissions: List[str], 
                 obj_param: Optional[str] = None,
                 organization_param: Optional[str] = None):
        """
        Initialize the permission checker.
        
        Args:
            required_permissions: List of permission slugs
            obj_param: Optional URL parameter for object-level permission check
            organization_param: Optional URL parameter for organization scope
        """
        self.required_permissions = required_permissions
        self.obj_param = obj_param
        self.organization_param = organization_param
    
    def has_permission(self, request, view):
        """
        Check if user has ALL of the required permissions.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get organization from URL if specified
        organization = None
        if self.organization_param:
            organization = view.kwargs.get(self.organization_param)
        
        # Get object for object-level check if specified
        obj = None
        if self.obj_param:
            obj = view.kwargs.get(self.obj_param)
            if obj and isinstance(obj, (int, str)):
                obj = getattr(view, 'get_object', lambda: None)()
        
        # Check each permission (must have ALL)
        for permission in self.required_permissions:
            if not user_has_permission(request.user, permission, organization=organization, obj=obj):
                return False
        
        return True
    
    def has_object_permission(self, request, view, obj):
        """
        Check object-level permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Check each permission on the object (must have ALL)
        for permission in self.required_permissions:
            if not has_object_permission(request.user, permission, obj):
                return False
        
        return True


class IsOwnerOrHasPermission(permissions.BasePermission):
    """
    Permission class that allows access if user is the owner OR has a specific permission.
    
    Usage:
        permission_classes = [IsOwnerOrHasPermission('edit_content', owner_field='user')]
    """
    
    def __init__(self, required_permission: str, owner_field: str = 'user',
                 obj_param: Optional[str] = None):
        """
        Initialize the permission checker.
        
        Args:
            required_permission: Permission slug to check
            owner_field: Field name on the object that contains the owner
            obj_param: Optional URL parameter for object-level permission check
        """
        self.required_permission = required_permission
        self.owner_field = owner_field
        self.obj_param = obj_param
    
    def has_permission(self, request, view):
        """
        Check if user has the permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get object for object-level check if specified
        obj = None
        if self.obj_param:
            obj = view.kwargs.get(self.obj_param)
            if obj and isinstance(obj, (int, str)):
                obj = getattr(view, 'get_object', lambda: None)()
        
        # If object exists, check ownership or permission
        if obj:
            owner = getattr(obj, self.owner_field, None)
            if owner and owner == request.user:
                return True
            
            return has_object_permission(request.user, self.required_permission, obj)
        
        # Check global permission
        return user_has_permission(request.user, self.required_permission)
    
    def has_object_permission(self, request, view, obj):
        """
        Check object-level permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Check ownership
        owner = getattr(obj, self.owner_field, None)
        if owner and owner == request.user:
            return True
        
        # Check permission on the object
        return has_object_permission(request.user, self.required_permission, obj)


class HasOrganizationRole(permissions.BasePermission):
    """
    Permission class to check if user has a specific role within an organization.
    
    Usage:
        permission_classes = [HasOrganizationRole('admin', organization_param='org_id')]
    """
    
    def __init__(self, required_role: Union[str, List[str]], 
                 organization_param: str = 'organization_id'):
        """
        Initialize the role checker.
        
        Args:
            required_role: Single role name or list of role names
            organization_param: URL parameter for organization ID
        """
        if isinstance(required_role, str):
            self.required_roles = [required_role]
        else:
            self.required_roles = required_role
        
        self.organization_param = organization_param
    
    def has_permission(self, request, view):
        """
        Check if user has the role within the organization.
        """
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get organization ID from URL
        organization_id = view.kwargs.get(self.organization_param)
        if not organization_id:
            return False
        
        # Check if user has the role within this organization
        user_roles = UserRole.objects.filter(
            user=request.user,
            role__name__in=self.required_roles,
            organization_id=organization_id,
            is_active=True
        )
        
        return user_roles.exists()


class IsSuperUser(permissions.BasePermission):
    """
    Permission class that only allows superusers.
    
    Usage:
        permission_classes = [IsSuperUser]
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return request.user.is_superuser
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        return request.user.is_superuser


class IsAuthenticatedOrReadOnly(permissions.BasePermission):
    """
    Permission class that allows read-only access for unauthenticated users.
    
    Usage:
        permission_classes = [IsAuthenticatedOrReadOnly]
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return request.user and request.user.is_authenticated


class DenyAll(permissions.BasePermission):
    """
    Permission class that denies all access.
    
    Usage:
        permission_classes = [DenyAll]
    """
    
    def has_permission(self, request, view):
        return False
    
    def has_object_permission(self, request, view, obj):
        return False


# ============================================================
# PERMISSION FACTORY FUNCTIONS
# ============================================================

def require_permission(permission: str, obj_param: Optional[str] = None,
                       organization_param: Optional[str] = None):
    """
    Factory function to create a HasPermission instance.
    
    Usage:
        permission_classes = [require_permission('view_content')]
    """
    return HasPermission(permission, obj_param, organization_param)


def require_role(role: Union[str, List[str]], organization_param: Optional[str] = None):
    """
    Factory function to create a HasRole instance.
    
    Usage:
        permission_classes = [require_role('admin')]
    """
    return HasRole(role, organization_param)


def require_any_permission(permissions: List[str], obj_param: Optional[str] = None,
                          organization_param: Optional[str] = None):
    """
    Factory function to create a HasAnyPermission instance.
    
    Usage:
        permission_classes = [require_any_permission(['view_content', 'edit_content'])]
    """
    return HasAnyPermission(permissions, obj_param, organization_param)


def require_all_permissions(permissions: List[str], obj_param: Optional[str] = None,
                           organization_param: Optional[str] = None):
    """
    Factory function to create a HasAllPermissions instance.
    
    Usage:
        permission_classes = [require_all_permissions(['view_content', 'edit_content'])]
    """
    return HasAllPermissions(permissions, obj_param, organization_param)


# ============================================================
# DECORATOR VERSIONS FOR FUNCTION-BASED VIEWS
# ============================================================

from functools import wraps
from django.http import JsonResponse
from rest_framework.exceptions import PermissionDenied


def permission_required(permission: str):
    """
    Decorator for function-based views to check permissions.
    
    Usage:
        @permission_required('edit_content')
        def update_content(request, content_id):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Check permission
            if not user_has_permission(request.user, permission):
                return JsonResponse({
                    'error': 'Permission denied',
                    'permission_required': permission
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return _wrapped_view
    return decorator


def role_required(role: str):
    """
    Decorator for function-based views to check roles.
    
    Usage:
        @role_required('admin')
        def admin_dashboard(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Check role
            if not UserRole.objects.filter(
                user=request.user,
                role__name=role,
                is_active=True
            ).exists():
                return JsonResponse({
                    'error': 'Permission denied',
                    'role_required': role
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return _wrapped_view
    return decorator