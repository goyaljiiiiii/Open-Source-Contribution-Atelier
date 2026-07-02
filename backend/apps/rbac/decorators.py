"""
Permission decorators for API views.
"""

from functools import wraps
from django.http import JsonResponse
from django.contrib.auth.models import User
from guardian.shortcuts import get_perms
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from typing import Optional


class PermissionRequiredMixin:
    """
    Mixin for class-based views to check permissions.
    """
    
    permission_required = None
    permission_required_object = None
    
    def has_permission(self):
        """
        Check if user has the required permission.
        """
        if not self.request.user.is_authenticated:
            return False
        
        if self.request.user.is_superuser:
            return True
        
        if self.permission_required:
            if self.permission_required_object:
                # Object-level permission check
                obj = self.get_object()
                return self.request.user.has_perm(
                    f"rbac.{self.permission_required}",
                    obj
                )
            else:
                # Global permission check
                return self.request.user.has_perm(
                    f"rbac.{self.permission_required}"
                )
        
        return True
    
    def dispatch(self, request, *args, **kwargs):
        """
        Override dispatch to check permissions.
        """
        if not self.has_permission():
            raise PermissionDenied("You do not have permission to perform this action.")
        
        return super().dispatch(request, *args, **kwargs)


class PermissionRequiredViewMixin:
    """
    Alternative mixin for views that don't inherit from generic views.
    """
    
    def check_permission(self, permission: str, obj=None) -> bool:
        """
        Check if current user has the required permission.
        
        Args:
            permission: Permission codename
            obj: Optional object for object-level check
        
        Returns:
            bool: True if user has permission
        """
        user = self.request.user
        
        if not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        if obj:
            return user.has_perm(f"rbac.{permission}", obj)
        else:
            return user.has_perm(f"rbac.{permission}")


def require_permission(permission: str, obj_param: Optional[str] = None):
    """
    Decorator for function-based views to check permissions.
    
    Args:
        permission: Permission codename
        obj_param: Optional parameter name for object-level check
    
    Usage:
        @require_permission('edit_content', obj_param='content_id')
        def update_content(request, content_id):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            user = request.user
            
            if not user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Get object for object-level permission check
            obj = None
            if obj_param and obj_param in kwargs:
                obj = kwargs[obj_param]
            
            # Check permission
            if obj:
                has_perm = user.has_perm(f"rbac.{permission}", obj)
            else:
                has_perm = user.has_perm(f"rbac.{permission}")
            
            if not has_perm:
                return JsonResponse({
                    'error': 'Permission denied',
                    'permission_required': permission
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return _wrapped_view
    return decorator


def require_any_permission(permissions: list, obj_param: Optional[str] = None):
    """
    Decorator that checks if user has ANY of the listed permissions.
    
    Args:
        permissions: List of permission codenames
        obj_param: Optional parameter name for object-level check
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            user = request.user
            
            if not user.is_authenticated:
                return JsonResponse({
                    'error': 'Authentication required'
                }, status=401)
            
            if user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Get object for object-level permission check
            obj = None
            if obj_param and obj_param in kwargs:
                obj = kwargs[obj_param]
            
            # Check any permission
            for permission in permissions:
                if obj:
                    has_perm = user.has_perm(f"rbac.{permission}", obj)
                else:
                    has_perm = user.has_perm(f"rbac.{permission}")
                
                if has_perm:
                    return view_func(request, *args, **kwargs)
            
            return JsonResponse({
                'error': 'Permission denied',
                'permissions_required': permissions
            }, status=403)
        
        return _wrapped_view
    return decorator


class DRFPermission(BasePermission):
    """
    Django REST Framework permission class for RBAC.
    """
    
    def __init__(self, permission: str, obj_param: Optional[str] = None):
        self.permission = permission
        self.obj_param = obj_param
    
    def has_permission(self, request, view):
        """Check global permission."""
        user = request.user
        
        if not user.is_authenticated:
            return False
        
        if user.is_superuser:
            return True
        
        if self.obj_param:
            # Object-level permission check
            obj = view.kwargs.get(self.obj_param)
            if obj:
                return user.has_perm(f"rbac.{self.permission}", obj)
        
        return user.has_perm(f"rbac.{self.permission}")
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permission."""
        user = request.user
        
        if user.is_superuser:
            return True
        
        return user.has_perm(f"rbac.{self.permission}", obj)


def drf_permission(permission: str, obj_param: Optional[str] = None):
    """
    Helper to create DRF permission classes.
    
    Usage:
        permission_classes = [drf_permission('edit_content')]
    """
    return DRFPermission(permission, obj_param)