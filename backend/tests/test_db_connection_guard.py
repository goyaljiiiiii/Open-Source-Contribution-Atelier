from django.db import OperationalError

from config.middleware import DatabaseConnectionGuardMiddleware


class _DummyRequest:
    method = "GET"
    path = "/api/health/db/"


def test_database_connection_guard_retries_safe_requests(mocker):
    call_count = {"count": 0}

    def get_response(request):
        call_count["count"] += 1
        if call_count["count"] < 2:
            raise OperationalError("temporary failure")
        return type("Response", (), {"status_code": 200})()

    sleep_mock = mocker.patch("config.middleware.time.sleep")
    close_mock = mocker.patch("config.middleware.close_old_connections")

    middleware = DatabaseConnectionGuardMiddleware(get_response)
    response = middleware(_DummyRequest())

    assert response.status_code == 200
    assert call_count["count"] == 2
    assert sleep_mock.called
    assert close_mock.called


def test_database_connection_guard_does_not_retry_post_requests(mocker):
    class PostRequest:
        method = "POST"
        path = "/api/content/"

    def get_response(request):
        raise OperationalError("temporary failure")

    sleep_mock = mocker.patch("config.middleware.time.sleep")
    middleware = DatabaseConnectionGuardMiddleware(get_response)

    try:
        middleware(PostRequest())
    except OperationalError:
        pass

    assert not sleep_mock.called