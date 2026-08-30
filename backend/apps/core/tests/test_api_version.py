from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.versioning import (
    parse_version_from_accept_header,
    parse_version_from_url_path,
)


class VersionParsingTests(SimpleTestCase):
    def test_parse_version_from_accept_header(self):
        self.assertEqual(
            parse_version_from_accept_header("application/json; version=1.0"), "1.0"
        )
        self.assertEqual(
            parse_version_from_accept_header("application/json; version=v1.0"), "1.0"
        )
        self.assertEqual(
            parse_version_from_accept_header("application/json; version=2.5"), "2.5"
        )
        self.assertIsNone(parse_version_from_accept_header("application/json"))
        self.assertIsNone(parse_version_from_accept_header(""))

    def test_parse_version_from_url_path(self):
        self.assertEqual(parse_version_from_url_path("/api/v1/content/"), "1.0")
        self.assertEqual(parse_version_from_url_path("/api/v1.0/content/"), "1.0")
        self.assertEqual(parse_version_from_url_path("/api/v2.1/challenges/"), "2.1")
        self.assertIsNone(parse_version_from_url_path("/api/content/"))
        self.assertIsNone(parse_version_from_url_path("/health/"))


class APIVersioningIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_accept_header_negotiation_valid(self):
        response = self.client.get(
            "/api/version/", HTTP_ACCEPT="application/json; version=1.0"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("X-API-Deprecation", response)

    def test_url_prefix_negotiation_valid(self):
        response = self.client.get("/api/v1/version/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("X-API-Deprecation", response)

    def test_unversioned_fallback_adds_deprecation_header(self):
        response = self.client.get("/api/version/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("X-API-Deprecation", response)
        self.assertEqual(
            response["X-API-Deprecation"],
            "This endpoint will require a version header after 90 days",
        )

    def test_unsupported_version_returns_406(self):
        response = self.client.get(
            "/api/version/", HTTP_ACCEPT="application/json; version=99.0"
        )
        self.assertEqual(response.status_code, status.HTTP_406_NOT_ACCEPTABLE)
        data = response.json()
        self.assertEqual(data["error"], "Unsupported API version")
        self.assertIn("99.0", data["detail"])

    def test_version_discovery_endpoint(self):
        response = self.client.get("/api/versions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["default_version"], "1.0")
        self.assertTrue(any(v["version"] == "1.0" for v in data["versions"]))

        v1_discovery = self.client.get("/api/v1/versions/")
        self.assertEqual(v1_discovery.status_code, status.HTTP_200_OK)

    @override_settings(
        DEPRECATED_API_VERSIONS={
            "1.0": {
                "deprecation": "@1700000000",
                "sunset": "Wed, 31 Dec 2026 23:59:59 GMT",
            }
        }
    )
    def test_deprecation_and_sunset_headers(self):
        response = self.client.get(
            "/api/version/", HTTP_ACCEPT="application/json; version=1.0"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get("Deprecation"), "@1700000000")
        self.assertEqual(response.get("Sunset"), "Wed, 31 Dec 2026 23:59:59 GMT")
