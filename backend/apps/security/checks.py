import urllib.parse

from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security)
def check_cors_origins(app_configs, **kwargs):
    errors = []

    debug = getattr(settings, "DEBUG", True)
    allow_all = getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False)
    allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])

    if not debug:
        if allow_all:
            errors.append(
                Error(
                    "CORS_ALLOW_ALL_ORIGINS must not be True when DEBUG is False.",
                    hint="Set CORS_ALLOW_ALL_ORIGINS = False and specify allowed origins in CORS_ALLOWED_ORIGINS.",
                    id="security.E001",
                )
            )

        if not allowed_origins:
            errors.append(
                Error(
                    "CORS_ALLOWED_ORIGINS is empty while DEBUG is False.",
                    hint="Configure CORS_ALLOWED_ORIGINS with valid frontend origins.",
                    id="security.E002",
                )
            )

        for origin in allowed_origins:
            if "*" in origin:
                errors.append(
                    Error(
                        f"Wildcard origin '{origin}' in CORS_ALLOWED_ORIGINS is not allowed in production.",
                        hint="Remove wildcards from CORS_ALLOWED_ORIGINS.",
                        id="security.E003",
                    )
                )
            parsed = urllib.parse.urlparse(origin)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                errors.append(
                    Error(
                        f"Invalid CORS origin '{origin}': must have valid http:// or https:// scheme and host.",
                        hint="Format origins as 'https://domain.com' without trailing slashes or paths.",
                        id="security.E004",
                    )
                )

    return errors
