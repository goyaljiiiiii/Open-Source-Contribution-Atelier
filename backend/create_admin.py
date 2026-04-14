import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

user, created = User.objects.get_or_create(username='admin@test.com', email='admin@test.com')
user.set_password('admin123')
user.is_staff = True
user.is_superuser = True
user.save()
print(f"User successfully created! Username: {user.username}, Active: {user.is_active}")
