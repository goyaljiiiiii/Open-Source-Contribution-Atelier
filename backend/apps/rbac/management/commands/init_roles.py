"""
Management command to initialize roles and permissions.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.rbac.models import Role, Permission
from apps.rbac.permissions import Permissions, ROLE_PERMISSIONS, initialize_permissions


class Command(BaseCommand):
    """
    Initialize roles and permissions.
    """
    
    help = 'Initialize roles and permissions for RBAC'
    
    def handle(self, *args, **options):
        self.stdout.write('Initializing roles and permissions...')
        
        # Initialize permissions
        initialize_permissions()
        self.stdout.write('✓ Permissions initialized')
        
        # Create roles
        role_data = {
            'admin': {
                'display_name': 'Administrator',
                'description': 'Full system access with all permissions'
            },
            'moderator': {
                'display_name': 'Moderator',
                'description': 'Can review content, approve badges, and moderate users'
            },
            'mentor': {
                'display_name': 'Mentor',
                'description': 'Can view learner progress and provide feedback'
            },
            'contributor': {
                'display_name': 'Contributor',
                'description': 'Can create and edit content, earn badges'
            },
            'viewer': {
                'display_name': 'Viewer',
                'description': 'Read-only access to content'
            },
        }
        
        for name, data in role_data.items():
            role, created = Role.objects.get_or_create(
                name=name,
                defaults={
                    'display_name': data['display_name'],
                    'description': data['description'],
                    'is_active': True
                }
            )
            
            if created:
                self.stdout.write(f'✓ Created role: {name}')
            else:
                self.stdout.write(f'✓ Updated role: {name}')
            
            # Assign permissions to role
            permission_codenames = ROLE_PERMISSIONS.get(name, [])
            if permission_codenames:
                permissions = Permission.objects.filter(codename__in=permission_codenames)
                role.permissions.set(permissions)
                self.stdout.write(f'  - Assigned {permissions.count()} permissions')
        
        self.stdout.write('\n✅ Role initialization complete!')
        self.stdout.write(f'Created/Updated {len(role_data)} roles')
        self.stdout.write(f'Total permissions: {Permission.objects.count()}')