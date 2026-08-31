import json
import time

import pytest
from django.test import Client
from django.urls import reverse

from apps.webhooks.services.signature_signer import HMACSignatureSigner

pytestmark = pytest.mark.django_db

SECRET_KEY = "test_github_webhook_secret_key"
PAYLOAD = {"action": "opened", "issue": {"id": 101, "title": "Test Bug Fix"}}
PAYLOAD_BYTES = json.dumps(PAYLOAD).encode("utf-8")
VALID_SIGNATURE = HMACSignatureSigner.sign_payload(SECRET_KEY, PAYLOAD_BYTES)


@pytest.fixture
def client():
    return Client()


@pytest.fixture(autouse=True)
def configure_secret_settings(settings):
    settings.GITHUB_WEBHOOK_SECRET = SECRET_KEY
    settings.WEBHOOK_SECRET = SECRET_KEY
    settings.WEBHOOK_SIGNING_KEYS = [("v1", SECRET_KEY)]
    settings.WEBHOOK_TIMESTAMP_WINDOW_SECONDS = 300


def test_valid_github_webhook_signature(client):
    """
    Test that a GitHub webhook request with a valid X-Hub-Signature-256 header returns 200 OK.
    """
    url = reverse("github-webhook")
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=VALID_SIGNATURE,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["message"] == "GitHub webhook received"


def test_invalid_github_webhook_signature_secret(client):
    """
    Test that a GitHub webhook signed with an incorrect secret returns 403 Forbidden.
    """
    url = reverse("github-webhook")
    invalid_sig = HMACSignatureSigner.sign_payload("wrong_secret_key", PAYLOAD_BYTES)
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=invalid_sig,
    )
    assert response.status_code == 403
    data = response.json()
    assert data["error"] == "Invalid webhook signature"


def test_tampered_payload_signature(client):
    """
    Test that sending a tampered payload with the original payload's signature returns 403 Forbidden.
    """
    url = reverse("github-webhook")
    tampered_payload = json.dumps(
        {"action": "opened", "issue": {"id": 101, "title": "Hacked Title"}}
    ).encode("utf-8")
    response = client.post(
        url,
        data=tampered_payload,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=VALID_SIGNATURE,
    )
    assert response.status_code == 403
    data = response.json()
    assert data["error"] == "Invalid webhook signature"


def test_missing_signature_header(client):
    """
    Test that a request missing the signature header returns 401 Unauthorized.
    """
    url = reverse("github-webhook")
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"] == "Missing X-Hub-Signature-256 header"


def test_expired_timestamp(client):
    """
    Test that a request with a timestamp older than the 300s window returns 400 Bad Request.
    """
    url = reverse("github-webhook")
    expired_time = time.time() - 600  # 10 minutes ago
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=VALID_SIGNATURE,
        HTTP_X_WEBHOOK_TIMESTAMP=str(expired_time),
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "Webhook timestamp expired / out of window"


def test_valid_timestamp_within_window(client):
    """
    Test that a request with a valid timestamp within the allowed window returns 200 OK.
    """
    url = reverse("github-webhook")
    current_time = time.time()
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=VALID_SIGNATURE,
        HTTP_X_WEBHOOK_TIMESTAMP=str(current_time),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


def test_key_rotation_support(client, settings):
    """
    Test that key rotation supports verifying signatures using alternate keys in WEBHOOK_SIGNING_KEYS.
    """
    url = reverse("github-webhook")
    rotated_secret = "secondary_rotated_secret_key"
    settings.WEBHOOK_SIGNING_KEYS = [("v1", "old_key"), ("v2", rotated_secret)]
    rotated_sig = HMACSignatureSigner.sign_payload(rotated_secret, PAYLOAD_BYTES)

    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=rotated_sig,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


def test_github_event_headers(client):
    """
    Test that custom GitHub event and delivery headers are captured and returned in the response.
    """
    url = reverse("github-webhook")
    response = client.post(
        url,
        data=PAYLOAD_BYTES,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=VALID_SIGNATURE,
        HTTP_X_GITHUB_EVENT="pull_request",
        HTTP_X_GITHUB_DELIVERY="72d3162e-cc78-11ec-816d-8547b1c71413",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["event"] == "pull_request"
    assert data["delivery_id"] == "72d3162e-cc78-11ec-816d-8547b1c71413"
