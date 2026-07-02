"""
Custom WebSocket middleware for connection authentication and throttling.
"""

import logging
from urllib.parse import parse_qs

from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_string: str):
    """
    Get user from JWT token.
    
    Args:
        token_string: JWT access token
    
    Returns:
        User or AnonymousUser
    """
    try:
        token = AccessToken(token_string)
        user_id = token.payload.get('user_id')
        User = get_user_model()
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist) as e:
        logger.warning(f"Invalid token: {e}")
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    """
    WebSocket middleware that authenticates using JWT token from query parameters.
    """
    
    async def __call__(self, scope, receive, send):
        """
        Authenticate WebSocket connection using token.
        """
        # Get query string parameters
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        
        # Get token from query params
        token = query_params.get('token', [None])[0]
        
        # If token provided, authenticate user
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
        
        # Store IP address for rate limiting
        headers = dict(scope.get('headers', []))
        forwarded_for = headers.get(b'x-forwarded-for', b'').decode('utf-8')
        if forwarded_for:
            scope['client'] = (forwarded_for.split(',')[0].strip(), 0)
        elif 'client' not in scope:
            scope['client'] = ('unknown', 0)
        
        # Call the next layer
        return await super().__call__(scope, receive, send)


class ThrottlingWebSocketMiddleware(BaseMiddleware):
    """
    WebSocket middleware for connection throttling.
    """
    
    def __init__(self, inner, app):
        super().__init__(inner)
        self.app = app
    
    async def __call__(self, scope, receive, send):
        """
        Apply throttling to WebSocket connections.
        """
        # Get user info
        user = scope.get('user', AnonymousUser())
        ip_address = scope.get('client', ['unknown'])[0]
        
        # Check if this is a WebSocket connection
        if scope.get('type') == 'websocket':
            # Store user info in scope for the consumer
            scope['user_id'] = user.id if user.is_authenticated else 0
            scope['ip_address'] = ip_address
        
        # Call the next layer
        return await super().__call__(scope, receive, send)