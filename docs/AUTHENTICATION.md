# JWT Authentication Architecture

The Open-Source Contribution Atelier uses JSON Web Tokens (JWT) for secure, stateless authentication. The platform is configured using `rest_framework_simplejwt` to provide secure access and refresh tokens.

## Token Lifecycle and Expiration Policies
- **Access Tokens**: Short-lived tokens used to authenticate requests to protected API endpoints. By default, they expire after **30 minutes** (configurable via `ACCESS_TOKEN_LIFETIME_MINUTES`).
- **Refresh Tokens**: Long-lived tokens used to securely obtain new access tokens without requiring the user to re-authenticate. By default, they expire after **7 days** (configurable via `REFRESH_TOKEN_LIFETIME_DAYS`).
- **Refresh Token Rotation**: When a valid refresh token is submitted to the `/api/auth/refresh/` endpoint, a *new* access token and a *new* refresh token are issued. The previously used refresh token is immediately blacklisted.

## Refresh Endpoint Specification
To obtain a new access token, clients must call the refresh endpoint before their current access token expires.

**POST** `/api/auth/refresh/`
**Payload:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1..."
}
```

**Success Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1...",
  "refresh": "eyJhbGciOiJIUzI1..."
}
```

**Error Responses:**
- `401 Unauthorized`: The refresh token is expired, tampered with, or blacklisted.
- `400 Bad Request`: The request payload is malformed (e.g., missing the `refresh` field).

## Security Considerations
1. **Refresh Token Rotation & Blacklisting**: We have enabled rotation and blacklisting (`ROTATE_REFRESH_TOKENS=True` and `BLACKLIST_AFTER_ROTATION=True`). If a malicious actor intercepts a refresh token and uses it, the legitimate user's subsequent use of the original refresh token will fail and trigger an alert, requiring re-authentication.
2. **Token Storage**: Client applications should never store tokens in LocalStorage if they are vulnerable to XSS. Prefer secure HttpOnly cookies or secure memory storage where possible.
3. **No Revocation Lists for Access Tokens**: Because access tokens are stateless and short-lived, they cannot be individually revoked before expiration. If immediate revocation is needed, we rely on the short lifespan of access tokens while revoking the associated refresh token.

## Integration Examples for Client Applications

### Intercepting 401 Responses (Axios / JavaScript)
When an API call fails with a `401 Unauthorized` status (indicating an expired access token), the client should automatically attempt to refresh the session.

```javascript
import axios from 'axios';

const api = axios.create({ baseURL: 'https://api.atelier.dev' });

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't already retried this request
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getStoredRefreshToken(); // e.g. from secure storage
      
      try {
        const { data } = await axios.post('https://api.atelier.dev/api/auth/refresh/', {
          refresh: refreshToken
        });
        
        // Store the new tokens (rotation)
        storeAccessToken(data.access);
        storeRefreshToken(data.refresh);
        
        // Retry the original request with the new access token
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // The refresh token is invalid or expired. Force logout.
        logoutUser();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```
