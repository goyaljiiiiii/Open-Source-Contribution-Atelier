import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.dashboard.views import LeaderboardView, LeaderboardPagination
from rest_framework.request import Request
from django.test import RequestFactory
from rest_framework.pagination import CursorPagination
from django.db.models import F

class Cursor(CursorPagination):
    page_size = 20
    ordering = ("-xp", "username", "id")

request = RequestFactory().get('/api/leaderboard/', SERVER_NAME='localhost')
drf_request = Request(request)
view = LeaderboardView()
qs = view.get_queryset()

paginator = Cursor()
try:
    page = paginator.paginate_queryset(qs, drf_request)
    print("Success! Annotated field cursor pagination works.")
    print("Next link:", paginator.get_next_link())
except Exception as e:
    import traceback
    traceback.print_exc()
