"""
RBAC models with roles, permissions, and object-level access control.
"""

from django.contrib.auth.models import User, Group
from django.db import models
from django.contrib.contenttypes.models import ContentType
from guardian.models import GroupObjectPermission, UserObjectPermission
from guardian.shortcuts import assign_perm, remove_perm
from django.utils import timezone
import logging

from apps.organizations.models import Organization

logger = logging.getLogger(__name__)


class Permission(models.Model):
    """
    Custom permission model extending Django's permission system.
    """
    
    CATEGORY_CHOICES = [
        ('content', 'Content Management'),
        ('users', 'User Management'),
        ('badges', 'Badge Management'),
        ('analytics', 'Analytics'),
        ('settings', 'Settings'),
        ('moderation', 'Moderation'),
        ('mentoring', 'Mentoring'),
        ('system', 'System'),
    ]
    
    objects = models.Manager()
    
    # Existing fields
    slug = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW FIELDS
    codename = models.CharField(max_length=100, unique=True, null=True, blank=True)
    name = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='system')
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        db_table = 'rbac_permissions'

    def __str__(self):
        return self.name or self.slug
    
    def save(self, *args, **kwargs):
        """Create or update Django's built-in permission."""
        # Set codename from slug if not provided
        if not self.codename:
            self.codename = self.slug
        
        # Set name from slug if not provided
        if not self.name:
            self.name = self.slug.replace('_', ' ').title()
        
        super().save(*args, **kwargs)
        
        # Sync with Django's permission system
        try:
            from django.contrib.auth.models import Permission as DjangoPermission
            from django.contrib.contenttypes.models import ContentType
            
            content_type = ContentType.objects.get_for_model(User)
            
            django_perm, created = DjangoPermission.objects.get_or_create(
                codename=self.codename,
                content_type=content_type,
                defaults={'name': self.name}
            )
            
            if not created and django_perm.name != self.name:
                django_perm.name = self.name
                django_perm.save()
            
            logger.debug(f"Permission '{self.codename}' synced with Django")
        except Exception as e:
            logger.warning(f"Failed to sync permission with Django: {e}")


class Role(models.Model):
    """
    Role model with predefined roles and custom permissions.
    """
    
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('moderator', 'Moderator'),
        ('mentor', 'Mentor'),
        ('contributor', 'Contributor'),
        ('viewer', 'Viewer'),
    ]
    
    objects = models.Manager()
    
    # Existing fields
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)
    is_system_role = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW FIELDS
    display_name = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['display_name', 'name']
        db_table = 'rbac_roles'

    def __str__(self):
        return self.display_name or self.name
    
    def save(self, *args, **kwargs):
        """Save role and sync with Django groups."""
        # Set display_name from name if not provided
        if not self.display_name:
            self.display_name = self.name.title()
        
        super().save(*args, **kwargs)
        
        # Sync with Django's group system
        try:
            group, created = Group.objects.get_or_create(name=self.name)
            if created:
                logger.info(f"Created Django group for role: {self.name}")
        except Exception as e:
            logger.warning(f"Failed to sync role with Django groups: {e}")
    
    def assign_permission(self, permission):
        """Assign a permission to this role."""
        self.permissions.add(permission)
        logger.info(f"Permission '{permission.slug}' assigned to role '{self.name}'")
    
    def remove_permission(self, permission):
        """Remove a permission from this role."""
        self.permissions.remove(permission)
        logger.info(f"Permission '{permission.slug}' removed from role '{self.name}'")
    
    def has_permission(self, permission_slug):
        """Check if role has a specific permission."""
        return self.permissions.filter(slug=permission_slug).exists()
    
    def get_all_permissions(self):
        """Get all permissions for this role."""
        return self.permissions.all()


class UserRole(models.Model):
    """
    Assigns roles to users with optional scope (organization).
    """
    
    objects = models.Manager()
    
    # Existing fields
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_roles",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW FIELDS
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_roles'
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "role", "organization")
        db_table = 'rbac_user_roles'
        indexes = [
            models.Index(fields=['user', 'role']),
            models.Index(fields=['organization']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        scope = self.organization.name if self.organization else 'Global'
        return f"{self.user.username} - {self.role.name} ({scope})"
    
    def save(self, *args, **kwargs):
        """Save assignment and sync Django groups."""
        super().save(*args, **kwargs)
        
        # Sync with Django's group system
        try:
            group = Group.objects.get(name=self.role.name)
            self.user.groups.add(group)
            
            # Assign all permissions from the role
            for permission in self.role.permissions.all():
                try:
                    assign_perm(permission.codename, self.user)
                except Exception as e:
                    logger.warning(f"Failed to assign permission {permission.slug}: {e}")
            
            logger.info(
                f"Role '{self.role.name}' assigned to user {self.user.username} "
                f"by {self.assigned_by.username if self.assigned_by else 'System'}"
            )
        except Group.DoesNotExist:
            logger.warning(f"Group for role '{self.role.name}' does not exist")
        except Exception as e:
            logger.warning(f"Failed to sync user role assignment: {e}")
    
    def revoke(self, revoked_by=None):
        """Revoke this role assignment."""
        self.is_active = False
        self.save()
        
        # Remove from Django groups
        try:
            group = Group.objects.get(name=self.role.name)
            self.user.groups.remove(group)
            
            # Remove all permissions from this role
            for permission in self.role.permissions.all():
                try:
                    remove_perm(permission.codename, self.user)
                except Exception as e:
                    logger.warning(f"Failed to remove permission {permission.slug}: {e}")
            
            logger.info(
                f"Role '{self.role.name}' revoked from user {self.user.username} "
                f"by {revoked_by.username if revoked_by else 'System'}"
            )
        except Group.DoesNotExist:
            logger.warning(f"Group for role '{self.role.name}' does not exist")
        except Exception as e:
            logger.warning(f"Failed to revoke user role assignment: {e}")
    
    def is_expired(self):
        """Check if the assignment has expired."""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False


class AuditLog(models.Model):
    """
    Audit log for permission changes.
    """
    
    ACTION_CHOICES = [
        ('assign', 'Permission Assigned'),
        ('revoke', 'Permission Revoked'),
        ('create', 'Permission Created'),
        ('delete', 'Permission Deleted'),
        ('update', 'Permission Updated'),
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('access_denied', 'Access Denied'),
    ]
    
    objects = models.Manager()
    
    # Existing fields
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="rbac_actions_performed",
    )
    target_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="rbac_actions_received"
    )
    action = models.CharField(max_length=50)  # 'assign' or 'revoke'
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True)
    organization = models.ForeignKey(
        Organization, on_delete=models.SET_NULL, null=True, blank=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.TextField(blank=True)
    
    # NEW FIELDS
    permission = models.ForeignKey(Permission, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        db_table = 'rbac_audit_logs'
        indexes = [
            models.Index(fields=['actor', 'target_user']),
            models.Index(fields=['action']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else 'System'
        return f"{actor_name} {self.action} {self.role} to {self.target_user.username}"
    
    @classmethod
    def log_action(cls, actor, target_user, action, role=None, organization=None, 
                   permission=None, details=None, request=None):
        """
        Helper method to create audit log entries.
        """
        audit_log = cls(
            actor=actor,
            target_user=target_user,
            action=action,
            role=role,
            organization=organization,
            permission=permission,
            details=details or '',
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else '',
            metadata={
                'timestamp': timezone.now().isoformat(),
            }
        )
        audit_log.save()
        return audit_log


# ============================================================
# OBJECT-LEVEL PERMISSION HELPERS
# ============================================================

def assign_object_permission(user, permission_slug, obj):
    """
    Assign object-level permission to a user.
    
    Args:
        user: User to assign permission to
        permission_slug: Permission slug
        obj: Object to grant permission on
    """
    try:
        permission = Permission.objects.get(slug=permission_slug)
        assign_perm(permission.codename, user, obj)
        logger.info(f"Object permission '{permission_slug}' assigned to {user.username} on {obj}")
        return True
    except Permission.DoesNotExist:
        logger.error(f"Permission '{permission_slug}' does not exist")
        return False


def remove_object_permission(user, permission_slug, obj):
    """
    Remove object-level permission from a user.
    
    Args:
        user: User to remove permission from
        permission_slug: Permission slug
        obj: Object to remove permission on
    """
    try:
        permission = Permission.objects.get(slug=permission_slug)
        remove_perm(permission.codename, user, obj)
        logger.info(f"Object permission '{permission_slug}' removed from {user.username} on {obj}")
        return True
    except Permission.DoesNotExist:
        logger.error(f"Permission '{permission_slug}' does not exist")
        return False


def has_object_permission(user, permission_slug, obj):
    """
    Check if user has object-level permission.
    
    Args:
        user: User to check
        permission_slug: Permission slug
        obj: Object to check permission on
    
    Returns:
        bool: True if user has permission
    """
    if user.is_superuser:
        return True
    
    try:
        permission = Permission.objects.get(slug=permission_slug)
        return user.has_perm(f"rbac.{permission.codename}", obj)
    except Permission.DoesNotExist:
        return False


def get_user_roles(user, organization=None):
    """
    Get all active roles for a user, optionally filtered by organization.
    
    Args:
        user: User to get roles for
        organization: Optional organization filter
    
    Returns:
        QuerySet: UserRole objects
    """
    queryset = UserRole.objects.filter(
        user=user,
        is_active=True
    )
    
    if organization:
        queryset = queryset.filter(organization=organization)
    
    return queryset


def get_user_permissions(user, organization=None, obj=None):
    """
    Get all permissions for a user.
    
    Args:
        user: User to get permissions for
        organization: Optional organization filter
        obj: Optional object for object-level permissions
    
    Returns:
        list: Permission slugs
    """
    if user.is_superuser:
        return list(Permission.objects.values_list('slug', flat=True))
    
    permissions = set()
    
    # Get permissions from roles
    user_roles = get_user_roles(user, organization)
    for user_role in user_roles:
        for permission in user_role.role.permissions.all():
            permissions.add(permission.slug)
    
    # Get object-level permissions
    if obj:
        from guardian.shortcuts import get_perms
        object_perms = get_perms(user, obj)
        permissions.update(object_perms)
    
    return list(permissions)


def user_has_permission(user, permission_slug, organization=None, obj=None):
    """
    Check if a user has a specific permission.
    
    Args:
        user: User to check
        permission_slug: Permission slug
        organization: Optional organization filter
        obj: Optional object for object-level check
    
    Returns:
        bool: True if user has permission
    """
    if user.is_superuser:
        return True
    
    # Check object-level permission first
    if obj and has_object_permission(user, permission_slug, obj):
        return True
    
    # Check role-based permissions
    user_roles = get_user_roles(user, organization)
    for user_role in user_roles:
        if user_role.role.has_permission(permission_slug):
            return True
    
    return False