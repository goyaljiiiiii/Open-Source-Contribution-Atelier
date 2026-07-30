import pytest
from django.test import Client


@pytest.mark.django_db
def test_host_header_validation_rejects_unallowed_hosts():
    """
    Ensures that Host header validation is active and rejects unknown hosts.
    This prevents Host header injection vulnerabilities.
    """
    client = Client()

    # An arbitrary unknown host should be rejected with a 400 Bad Request
    response = client.get("/health/", HTTP_HOST="malicious-attacker.com")

    assert response.status_code == 400
