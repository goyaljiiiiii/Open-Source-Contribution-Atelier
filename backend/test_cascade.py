import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.content.models import Comment

User = get_user_model()

# Create dummy user and comment
u = User.objects.create(username="test_cascade_del")
c = Comment.objects.create(user=u, content="Test")

# Delete user
try:
    u.delete()
    print("User deleted.")
    
    # Check comment
    count = Comment.all_objects.filter(id=c.id).count()
    print(f"Comment count after user delete: {count}")
    
except Exception as e:
    import traceback
    traceback.print_exc()

# Cleanup
User.objects.filter(username="test_cascade_del").delete()
Comment.all_objects.filter(content="Test").delete()
