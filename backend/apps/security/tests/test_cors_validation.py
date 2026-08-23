from django.test import SimpleTestCase, override_settings

from apps.security.checks import check_cors_origins


class CORSValidationSystemCheckTests(SimpleTestCase):
    @override_settings(
        DEBUG=False,
        CORS_ALLOW_ALL_ORIGINS=True,
        CORS_ALLOWED_ORIGINS=["https://atelier.dev"],
    )
    def test_allow_all_origins_disallowed_in_production(self):
        errors = check_cors_origins(None)
        self.assertTrue(any(e.id == "security.E001" for e in errors))

    @override_settings(
        DEBUG=False,
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=[],
    )
    def test_empty_allowed_origins_disallowed_in_production(self):
        errors = check_cors_origins(None)
        self.assertTrue(any(e.id == "security.E002" for e in errors))

    @override_settings(
        DEBUG=False,
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=["*"],
    )
    def test_wildcard_origin_disallowed_in_production(self):
        errors = check_cors_origins(None)
        self.assertTrue(any(e.id == "security.E003" for e in errors))

    @override_settings(
        DEBUG=False,
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=["invalidscheme://foo.com", "not-a-url"],
    )
    def test_malformed_origins_disallowed_in_production(self):
        errors = check_cors_origins(None)
        self.assertTrue(any(e.id == "security.E004" for e in errors))

    @override_settings(
        DEBUG=False,
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=["https://atelier.dev", "https://app.atelier.dev"],
    )
    def test_valid_origins_pass_in_production(self):
        errors = check_cors_origins(None)
        self.assertEqual(errors, [])
