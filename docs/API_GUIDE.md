# Open Source Contribution Atelier - API Versioning & Usage Guide

This guide describes the API versioning strategy, negotiation mechanisms, deprecation lifecycle, and developer guidelines for the Open Source Contribution Atelier REST API.

---

## 1. Overview

To support iterative feature development without breaking existing integrations, all API endpoints under `/api/` implement strict **API Versioning**. 

The current stable API version is **`1.0`**.

---

## 2. Version Negotiation Mechanisms

Clients can specify the desired API version using either **Accept Header Negotiation** (recommended) or **URL Prefix Fallback**.

### A. Accept Header Negotiation (Recommended)

Clients request a specific API version by providing the `version` parameter in the HTTP `Accept` header.

```http
GET /api/content/lessons/ HTTP/1.1
Host: localhost:8000
Accept: application/json; version=1.0
```

- **Supported Format**: `Accept: application/json; version=X.Y` (or `version=vX.Y`)
- **Example**: `Accept: application/json; version=1.0`

---

### B. URL Prefix Fallback

For simplified client integrations or browser debugging, versioned routes are accessible via explicit version URL prefixes under `/api/v1/`.

```http
GET /api/v1/content/lessons/ HTTP/1.1
Host: localhost:8000
Accept: application/json
```

---

### C. Unversioned Request Handling & Deprecation Notice

Requests sent directly to `/api/*` without a `version` parameter in the `Accept` header or a URL version prefix will:
1. Fall back to the default API version (`1.0`).
2. Include an explicit deprecation warning response header:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-API-Deprecation: This endpoint will require a version header after 90 days
```

> [!WARNING]
> Unversioned requests will require an explicit version header after the 90-day transition grace period.

---

### D. Invalid Version Requests (`406 Not Acceptable`)

If a client requests an unsupported or invalid API version, the server returns an `HTTP 406 Not Acceptable` response with error details:

```http
HTTP/1.1 406 Not Acceptable
Content-Type: application/json

{
  "error": "Unsupported API version",
  "detail": "Invalid API version '99.0'. Supported versions are: 1.0.",
  "supported_versions": ["1.0"]
}
```

---

## 3. Version Discovery Endpoint

Clients and integration tools can query available API versions, lifecycle statuses, and changelog URLs dynamically via the discovery endpoint.

- **Endpoint**: `GET /api/versions/` (or `GET /api/v1/versions/`)
- **Authentication**: Unauthenticated / Public

### Example Response:

```json
{
  "default_version": "1.0",
  "versions": [
    {
      "version": "1.0",
      "status": "stable",
      "changelog_url": "/docs/changelog/v1.0",
      "sunset": null,
      "deprecation": null
    }
  ]
}
```

---

## 4. Endpoint Deprecation and Sunset Policy

When an API version or endpoint is scheduled for removal, standard RFC deprecation response headers are attached to all responses for that version:

| Response Header | Description | Standard |
| :--- | :--- | :--- |
| `X-API-Deprecation` | Warning header for unversioned fallback requests | Custom Header |
| `Deprecation` | Date or boolean indicating when the feature was deprecated | RFC 9261 |
| `Sunset` | HTTP-date indicating when the endpoint will be permanently retired | RFC 8594 |

---

## 5. Developer Guide: Adding or Deprecating API Versions

### Adding a New Version
1. Update `ALLOWED_API_VERSIONS` in `backend/config/settings.py`:
   ```python
   ALLOWED_API_VERSIONS = ["1.0", "2.0"]
   ```
2. Define version discovery entry in `API_VERSION_DISCOVERY`:
   ```python
   API_VERSION_DISCOVERY = {
       "1.0": {"status": "deprecated", "changelog_url": "/docs/changelog/v1.0"},
       "2.0": {"status": "stable", "changelog_url": "/docs/changelog/v2.0"},
   }
   ```
3. Update `backend/config/urls.py` to route `/api/v2/` patterns using `VersionedAPIRouter` or `api_v2_patterns`.

### Marking a Version as Deprecated
Add deprecation dates to `DEPRECATED_API_VERSIONS` in `backend/config/settings.py`:

```python
DEPRECATED_API_VERSIONS = {
    "1.0": {
        "deprecation": "@1700000000",
        "sunset": "Wed, 31 Dec 2026 23:59:59 GMT",
    }
}
```
