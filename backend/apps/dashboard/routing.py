"""
WebSocket routing configuration with authentication and connection throttling.
"""

from django.urls import re_path
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack

from . import consumers
from .websocket_middleware import TokenAuthMiddleware, ThrottlingWebSocketMiddleware

# ============================================================
# WEBSOCKET URL PATTERNS
# ============================================================

websocket_urlpatterns = [
    # Leaderboard WebSocket
    re_path(r"^ws/leaderboard/$", consumers.LeaderboardConsumer.as_asgi()),
    
    # Dashboard WebSocket (if you have this)
    re_path(r"^ws/dashboard/$", consumers.DashboardConsumer.as_asgi()),
    
    # Dashboard with room parameter
    re_path(r"^ws/dashboard/(?P<room_name>\w+)/$", consumers.DashboardConsumer.as_asgi()),
]

# ============================================================
# WEBSOCKET APPLICATION WITH MIDDLEWARE STACK
# ============================================================

# Apply authentication and throttling middleware to all WebSocket connections
application = URLRouter([
    # Apply middleware to all WebSocket routes
    re_path(
        r"^ws/",
        AuthMiddlewareStack(
            TokenAuthMiddleware(
                ThrottlingWebSocketMiddleware(
                    URLRouter(websocket_urlpatterns)
                )
            )
        ),
    ),
])

# ============================================================
# ALTERNATIVE: Apply middleware per route (if you prefer)
# ============================================================

# If you want to apply throttling only to specific routes:
leaderboard_application = URLRouter([
    re_path(
        r"^ws/leaderboard/$",
        AuthMiddlewareStack(
            TokenAuthMiddleware(
                ThrottlingWebSocketMiddleware(
                    consumers.LeaderboardConsumer.as_asgi()
                )
            )
        ),
    ),
])

dashboard_application = URLRouter([
    re_path(
        r"^ws/dashboard/",
        AuthMiddlewareStack(
            TokenAuthMiddleware(
                ThrottlingWebSocketMiddleware(
                    consumers.DashboardConsumer.as_asgi()
                )
            )
        ),
    ),
])

# Combined application (recommended for multiple routes)
websocket_application = URLRouter([
    re_path(r"^ws/leaderboard/", leaderboard_application),
    re_path(r"^ws/dashboard/", dashboard_application),
])

# ============================================================
# EXPORT FOR ASGI
# ============================================================

# Export the main application for use in asgi.py
# Default: use the combined application with full middleware stack
default_application = application