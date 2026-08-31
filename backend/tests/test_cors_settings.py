from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from config import settings


class CorsSettingsValidationTests(SimpleTestCase):
    """Verify production CORS configuration cannot silently allow every origin."""

    def test_wildcard_origin_is_rejected_when_debug_is_disabled(self):
        with patch.object(settings, "DEBUG", False):
            with self.assertRaises(ImproperlyConfigured):
                settings._validate_cors_allowed_origins(["*"])

    def test_explicit_origins_are_allowed_when_debug_is_disabled(self):
        with patch.object(settings, "DEBUG", False):
            origins = ["https://example.com"]
            self.assertEqual(
                settings._validate_cors_allowed_origins(origins),
                origins,
            )

    def test_wildcard_origin_is_allowed_for_local_debug(self):
        with patch.object(settings, "DEBUG", True):
            self.assertEqual(
                settings._validate_cors_allowed_origins(["*"]),
                ["*"],
            )
