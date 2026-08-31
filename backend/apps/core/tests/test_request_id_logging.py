import logging

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase

from apps.core.logging_filters import RequestIdFilter
from apps.core.middleware.request_id import RequestIdMiddleware, get_request_id


class RequestIdConsoleLoggingTests(SimpleTestCase):
    """
    Verifies that general app/django logger.info/error calls (routed through
    the "console" handler) carry the current request's correlation id, not
    just the dedicated "audit" logger.
    """

    def setUp(self):
        self.factory = RequestFactory()

    def _format_like_console_handler(self, record):
        RequestIdFilter().filter(record)
        formatter = logging.Formatter(
            "{levelname} {asctime} [{request_id}] {module} {message}", style="{"
        )
        return formatter.format(record)

    def test_app_logger_output_includes_request_id_during_request(self):
        captured = {}

        def get_response(request):
            record = logging.LogRecord(
                name="apps.progress.views",
                level=logging.INFO,
                pathname=__file__,
                lineno=1,
                msg="Something happened",
                args=(),
                exc_info=None,
            )
            captured["formatted"] = self._format_like_console_handler(record)
            captured["request_id"] = get_request_id()
            return HttpResponse("OK")

        middleware = RequestIdMiddleware(get_response)
        request = self.factory.get("/", HTTP_X_REQUEST_ID="corr-abc-123")
        response = middleware(request)

        self.assertEqual(response["X-Request-ID"], "corr-abc-123")
        self.assertEqual(captured["request_id"], "corr-abc-123")
        self.assertIn("[corr-abc-123]", captured["formatted"])

    def test_app_logger_output_has_placeholder_outside_a_request(self):
        record = logging.LogRecord(
            name="apps.progress.views",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="No active request",
            args=(),
            exc_info=None,
        )
        formatted = self._format_like_console_handler(record)
        self.assertIn("[-]", formatted)
