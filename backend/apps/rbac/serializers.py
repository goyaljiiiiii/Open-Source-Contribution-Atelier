"""
Serializers for RBAC models with advanced features including
nested relationships, validation, and audit logging.
"""

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.utils import timezone

from .models import AuditLog, Permission, Role, UserRole
from .utils import get_user_permissions


# ============================================================
# PERMISSION SERIALIZERS
# ============================================================

class PermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for Permission model.
    """
    
    category_display = serializers.CharField(
        source='get_category_display', 
        read_only=True
    )
    
    class Meta:
        model = Permission
        fields = [
            "id", 
            "slug", 
            "codename",
            "name", 
            "description", 
            "category",
            "category_display",
            "is_active",
            "created_at",
            "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
    
    def validate_slug(self, value):
        """Validate that slug is unique."""
        if Permission.objects.filter(slug=value).exclude(id=self.instance.id if self.instance else None).exists():
            raise ValidationError("A permission with this slug already exists.")
        return value
    
    def validate_codename(self, value):
        """Validate that codename is unique."""
        if value and Permission.objects.filter(codename=value).exclude(id=self.instance.id if self.instance else None).exists():
            raise ValidationError("A permission with this codename already exists.")
        return value


class PermissionListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing permissions.
    """
    
    class Meta:
        model = Permission
        fields = ["id", "slug", "name", "category"]


# ============================================================
# ROLE SERIALIZERS
# ============================================================

class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer for Role model with nested permissions.
    """
    
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of permission IDs to assign to the role"
    )
    user_count = serializers.SerializerMethodField()
    is_system_role_display = serializers.CharField(
        source='get_is_system_role_display',
        read_only=True
    )
    
    class Meta:
        model = Role
        fields = [
            "id",
            "name",
            "display_name",
            "description",
            "is_system_role",
            "is_system_role_display",
            "is_active",
            "permissions",
            "permission_ids",
            "user_count",
            "created_at",
            "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
    
    def get_user_count(self, obj):
        """Get count of users assigned to this role."""
        return obj.user_roles.filter(is_active=True).count()
    
    def validate_name(self, value):
        """Validate that role name is unique."""
        if Role.objects.filter(name=value).exclude(id=self.instance.id if self.instance else None).exists():
            raise ValidationError("A role with this name already exists.")
        return value
    
    def validate(self, data):
        """Validate role data."""
        # Check if system role is being modified
        if self.instance and self.instance.is_system_role:
            if 'is_system_role' in data and data['is_system_role'] == False:
                # Allow changing system role status only for non-critical roles
                pass
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Create role with permissions."""
        permission_ids = validated_data.pop('permission_ids', [])
        
        # Set display_name if not provided
        if 'display_name' not in validated_data or not validated_data['display_name']:
            validated_data['display_name'] = validated_data['name'].title()
        
        role = Role.objects.create(**validated_data)
        
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            role.permissions.set(permissions)
        
        return role
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Update role with permissions."""
        permission_ids = validated_data.pop('permission_ids', None)
        
        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        if permission_ids is not None:
            permissions = Permission.objects.filter(id__in=permission_ids)
            instance.permissions.set(permissions)
        
        return instance


class RoleListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing roles.
    """
    
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Role
        fields = ["id", "name", "display_name", "description", "is_active", "user_count"]
    
    def get_user_count(self, obj):
        return obj.user_roles.filter(is_active=True).count()


# ============================================================
# USER ROLE SERIALIZERS
# ============================================================

class UserRoleSerializer(serializers.ModelSerializer):
    """
    Serializer for UserRole model with nested user and role details.
    """
    
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        source='role',
        queryset=Role.objects.filter(is_active=True),
        write_only=True,
        help_text="ID of the role to assign"
    )
    user_details = serializers.SerializerMethodField()
    role_details = RoleListSerializer(source='role', read_only=True)
    assigned_by_name = serializers.CharField(
        source='assigned_by.username',
        read_only=True,
        default=None
    )
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = UserRole
        fields = [
            "id",
            "user",
            "user_details",
            "role",
            "role_id",
            "role_details",
            "organization",
            "assigned_by",
            "assigned_by_name",
            "assigned_at",
            "expires_at",
            "is_active",
            "is_expired",
            "created_at",
            "updated_at"
        ]
        read_only_fields = ["id", "assigned_by", "created_at", "updated_at"]
    
    def get_user_details(self, obj):
        """Get user details including permissions."""
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
            'is_active': obj.user.is_active,
            'is_superuser': obj.user.is_superuser,
            'permissions': get_user_permissions(obj.user, obj.organization),
            'last_login': obj.user.last_login.isoformat() if obj.user.last_login else None,
        }
    
    def get_is_expired(self, obj):
        """Check if the role assignment has expired."""
        return obj.is_expired() if obj.expires_at else False
    
    def validate(self, data):
        """Validate user role assignment."""
        user = data.get('user')
        role = data.get('role')
        organization = data.get('organization')
        
        # Check if user already has this role assignment
        if UserRole.objects.filter(
            user=user,
            role=role,
            organization=organization,
            is_active=True
        ).exists():
            raise ValidationError(
                "This user already has this role assignment."
            )
        
        # Check if the role is active
        if not role.is_active:
            raise ValidationError("This role is not active.")
        
        # Check if assignment expires in the past
        expires_at = data.get('expires_at')
        if expires_at and expires_at <= timezone.now():
            raise ValidationError("Expiration date must be in the future.")
        
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Create user role assignment."""
        # Set assigned_by from context
        validated_data['assigned_by'] = self.context.get('request').user
        
        user_role = UserRole.objects.create(**validated_data)
        return user_role
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Update user role assignment."""
        # Handle expiration
        if 'expires_at' in validated_data:
            expires_at = validated_data['expires_at']
            if expires_at and expires_at <= timezone.now():
                raise ValidationError("Expiration date must be in the future.")
        
        return super().update(instance, validated_data)


class UserRoleAssignSerializer(serializers.Serializer):
    """
    Serializer for assigning roles to users in bulk.
    """
    
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of user IDs to assign the role to"
    )
    role_id = serializers.IntegerField(help_text="ID of the role to assign")
    organization_id = serializers.IntegerField(
        required=False,
        help_text="Optional organization ID for scoping"
    )
    expires_at = serializers.DateTimeField(
        required=False,
        help_text="Optional expiration date for the assignment"
    )
    
    def validate_user_ids(self, value):
        """Validate that all users exist."""
        if not value:
            raise ValidationError("At least one user ID is required.")
        
        users = User.objects.filter(id__in=value)
        if len(users) != len(value):
            raise ValidationError("One or more users do not exist.")
        
        return value
    
    def validate_role_id(self, value):
        """Validate that role exists and is active."""
        try:
            role = Role.objects.get(id=value, is_active=True)
        except Role.DoesNotExist:
            raise ValidationError("Role does not exist or is not active.")
        
        return value


# ============================================================
# AUDIT LOG SERIALIZERS
# ============================================================

class AuditLogSerializer(serializers.ModelSerializer):
    """
    Serializer for AuditLog model with nested relationships.
    """
    
    actor_name = serializers.CharField(source="actor.username", read_only=True)
    actor_details = serializers.SerializerMethodField()
    target_user_name = serializers.CharField(
        source="target_user.username", read_only=True
    )
    target_user_details = serializers.SerializerMethodField()
    role_name = serializers.CharField(source="role.name", read_only=True)
    permission_slug = serializers.CharField(
        source="permission.slug", 
        read_only=True,
        default=None
    )
    action_display = serializers.CharField(
        source='get_action_display',
        read_only=True
    )
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True,
        default=None
    )
    
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "actor_details",
            "target_user",
            "target_user_name",
            "target_user_details",
            "action",
            "action_display",
            "role",
            "role_name",
            "permission",
            "permission_slug",
            "organization",
            "organization_name",
            "ip_address",
            "user_agent",
            "details",
            "metadata",
            "timestamp"
        ]
        read_only_fields = ["id", "timestamp"]
    
    def get_actor_details(self, obj):
        """Get actor details."""
        if obj.actor:
            return {
                'id': obj.actor.id,
                'username': obj.actor.username,
                'email': obj.actor.email,
            }
        return None
    
    def get_target_user_details(self, obj):
        """Get target user details."""
        return {
            'id': obj.target_user.id,
            'username': obj.target_user.username,
            'email': obj.target_user.email,
            'is_active': obj.target_user.is_active,
        }


class AuditLogListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing audit logs.
    """
    
    actor_name = serializers.CharField(source="actor.username", read_only=True)
    target_user_name = serializers.CharField(
        source="target_user.username", read_only=True
    )
    action_display = serializers.CharField(
        source='get_action_display',
        read_only=True
    )
    
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_name",
            "target_user_name",
            "action",
            "action_display",
            "timestamp",
        ]


# ============================================================
# USER PERMISSIONS SERIALIZER
# ============================================================

class UserPermissionsSerializer(serializers.Serializer):
    """
    Serializer for user permissions.
    """
    
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    permissions = serializers.ListField(
        child=serializers.CharField()
    )
    roles = serializers.ListField(
        child=serializers.DictField()
    )
    is_superuser = serializers.BooleanField()
    
    def to_representation(self, instance):
        """
        Convert user instance to permission representation.
        """
        user = instance
        return {
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'is_superuser': user.is_superuser,
            'permissions': get_user_permissions(user),
            'roles': [
                {
                    'id': ur.role.id,
                    'name': ur.role.name,
                    'display_name': ur.role.display_name,
                    'organization': ur.organization.name if ur.organization else None,
                    'expires_at': ur.expires_at.isoformat() if ur.expires_at else None,
                }
                for ur in user.user_roles.filter(is_active=True)
            ],
            'last_login': user.last_login.isoformat() if user.last_login else None,
        }


# ============================================================
# INITIAL PERMISSIONS SERIALIZER
# ============================================================

class InitializePermissionsSerializer(serializers.Serializer):
    """
    Serializer for initializing permissions.
    """
    
    confirm = serializers.BooleanField(
        help_text="Set to true to confirm initialization",
        required=True
    )
    
    def validate_confirm(self, value):
        if not value:
            raise ValidationError("Must confirm to initialize permissions.")
        return value