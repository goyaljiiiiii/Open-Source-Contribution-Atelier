from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group

class Command(BaseCommand):
    help = 'Creates default roles (Groups) for the application'

    def handle(self, *args, **options):
        roles = ['Admin', 'Moderator']
        
        for role in roles:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created role: {role}'))
            else:
                self.stdout.write(self.style.WARNING(f'Role already exists: {role}'))
                
        self.stdout.write(self.style.SUCCESS('Role setup complete.'))
