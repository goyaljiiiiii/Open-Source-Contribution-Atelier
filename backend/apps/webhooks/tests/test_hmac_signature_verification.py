import json

import pytest
from cryptography.fernet import InvalidToken
from django.http import JsonResponse
from django.test import RequestFactory

from apps.webhooks.security import (
    compute_signature,
    decrypt_secret,
    encrypt_secret,
    get_fernet_cipher,
    require_webhook_signature,
    verify_signature,
)


@pytest.fixture
def rf():
    return RequestFactory()


@pytest.fixture
def sample_payload():
    return json.dumps({"event": "lesson.completed", "user_id": 42}).encode("utf-8")


@pytest.fixture
def secret_key():
    return "webhook_test_secret_key_12345"


class TestFernetSecretEncryption:
    def test_get_fernet_cipher(self):
        cipher = get_fernet_cipher()
        assert cipher is not None

    def test_encrypt_decrypt_roundtrip(self):
        raw_secret = "whsec_super_secret_payload_key"
        encrypted = encrypt_secret(raw_secret)
        assert encrypted != raw_secret
        assert isinstance(encrypted, str)

        decrypted = decrypt_secret(encrypted)
        assert decrypted == raw_secret

    def test_encrypt_empty_secret_returns_empty_string(self):
        assert encrypt_secret("") == ""
        assert decrypt_secret("") == ""

    def test_decrypt_invalid_token_raises_error(self):
        with pytest.raises(InvalidToken):
            decrypt_secret("invalid_encrypted_ciphertext_token")


class TestHMACSignatureComputation:
    def test_compute_signature_format(self, secret_key, sample_payload):
        sig = compute_signature(secret_key, sample_payload)
        assert isinstance(sig, str)
        assert len(sig) == 64
        assert int(sig, 16) > 0  # valid hex

    def test_compute_signature_deterministic(self, secret_key, sample_payload):
        sig1 = compute_signature(secret_key, sample_payload)
        sig2 = compute_signature(secret_key, sample_payload)
        assert sig1 == sig2

    def test_compute_signature_payload_tamper_fails(self, secret_key, sample_payload):
        sig1 = compute_signature(secret_key, sample_payload)
        sig2 = compute_signature(secret_key, sample_payload + b"_tampered")
        assert sig1 != sig2

    def test_compute_signature_secret_change_fails(self, sample_payload):
        sig1 = compute_signature("secret_one", sample_payload)
        sig2 = compute_signature("secret_two", sample_payload)
        assert sig1 != sig2


class TestHMACSignatureVerification:
    def test_verify_signature_plain_valid(self, secret_key, sample_payload):
        sig = compute_signature(secret_key, sample_payload)
        assert verify_signature(secret_key, sample_payload, sig) is True

    def test_verify_signature_with_sha256_prefix(self, secret_key, sample_payload):
        raw_sig = compute_signature(secret_key, sample_payload)
        prefixed_sig = f"sha256={raw_sig}"
        assert verify_signature(secret_key, sample_payload, prefixed_sig) is True

    def test_verify_signature_with_secret_list(self, secret_key, sample_payload):
        sig = compute_signature(secret_key, sample_payload)
        secrets = ["old_revoked_secret", secret_key, "backup_secret"]
        assert verify_signature(secrets, sample_payload, sig) is True

    def test_verify_signature_with_key_id_tuples(self, secret_key, sample_payload):
        sig = compute_signature(secret_key, sample_payload)
        key_tuples = [("v1", "revoked_secret"), ("v2", secret_key)]
        assert verify_signature(key_tuples, sample_payload, sig) is True

    def test_verify_signature_tampered_payload_returns_false(
        self, secret_key, sample_payload
    ):
        sig = compute_signature(secret_key, sample_payload)
        assert verify_signature(secret_key, sample_payload + b"!", sig) is False

    def test_verify_signature_invalid_sig_returns_false(
        self, secret_key, sample_payload
    ):
        assert verify_signature(secret_key, sample_payload, "deadbeef" * 8) is False

    @pytest.mark.parametrize("empty_val", ["", None])
    def test_verify_signature_empty_signature_returns_false(
        self, secret_key, sample_payload, empty_val
    ):
        assert verify_signature(secret_key, sample_payload, empty_val) is False


class TestRequireWebhookSignatureDecorator:
    def test_decorator_valid_signature_passes(self, rf, secret_key, sample_payload):
        @require_webhook_signature(secret_key)
        def my_view(request):
            return JsonResponse({"ok": True})

        sig = compute_signature(secret_key, sample_payload)
        req = rf.post(
            "/api/webhooks/",
            data=sample_payload,
            content_type="application/json",
            HTTP_X_SIGNATURE=sig,
        )
        resp = my_view(req)
        assert resp.status_code == 200
        assert json.loads(resp.content) == {"ok": True}

    def test_decorator_missing_signature_header_returns_403(
        self, rf, secret_key, sample_payload
    ):
        @require_webhook_signature(secret_key)
        def my_view(request):
            return JsonResponse({"ok": True})

        req = rf.post(
            "/api/webhooks/", data=sample_payload, content_type="application/json"
        )
        resp = my_view(req)
        assert resp.status_code == 403
        assert json.loads(resp.content) == {"error": "Missing signature header"}

    def test_decorator_invalid_signature_returns_403(
        self, rf, secret_key, sample_payload
    ):
        @require_webhook_signature(secret_key)
        def my_view(request):
            return JsonResponse({"ok": True})

        req = rf.post(
            "/api/webhooks/",
            data=sample_payload,
            content_type="application/json",
            HTTP_X_SIGNATURE="invalid_hash_signature",
        )
        resp = my_view(req)
        assert resp.status_code == 403
        assert json.loads(resp.content) == {"error": "Invalid signature"}

    def test_decorator_empty_payload_returns_400(self, rf, secret_key):
        @require_webhook_signature(secret_key)
        def my_view(request):
            return JsonResponse({"ok": True})

        req = rf.post(
            "/api/webhooks/",
            data=b"",
            content_type="application/json",
            HTTP_X_SIGNATURE="any_sig",
        )
        resp = my_view(req)
        assert resp.status_code == 400
        assert json.loads(resp.content) == {"error": "Empty payload"}

    def test_decorator_callable_secret_resolution(self, rf, sample_payload):
        dynamic_secret = "tenant_dynamic_secret"

        def get_tenant_secret(request):
            return dynamic_secret

        @require_webhook_signature(get_tenant_secret)
        def my_view(request):
            return JsonResponse({"tenant": "ok"})

        sig = compute_signature(dynamic_secret, sample_payload)
        req = rf.post(
            "/api/webhooks/",
            data=sample_payload,
            content_type="application/json",
            HTTP_X_SIGNATURE=sig,
        )
        resp = my_view(req)
        assert resp.status_code == 200
        assert json.loads(resp.content) == {"tenant": "ok"}

    def test_decorator_missing_secret_returns_500(self, rf, sample_payload):
        @require_webhook_signature(lambda r: None)
        def my_view(request):
            return JsonResponse({"ok": True})

        req = rf.post(
            "/api/webhooks/",
            data=sample_payload,
            content_type="application/json",
            HTTP_X_SIGNATURE="any_sig",
        )
        resp = my_view(req)
        assert resp.status_code == 500
        assert json.loads(resp.content) == {
            "error": "Configuration error: Missing secret"
        }

    def test_decorator_custom_header_name(self, rf, secret_key, sample_payload):
        @require_webhook_signature(secret_key, header_name="HTTP_X_HUB_SIGNATURE_256")
        def my_view(request):
            return JsonResponse({"hub": True})

        sig = f"sha256={compute_signature(secret_key, sample_payload)}"
        req = rf.post(
            "/api/webhooks/",
            data=sample_payload,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=sig,
        )
        resp = my_view(req)
        assert resp.status_code == 200
        assert json.loads(resp.content) == {"hub": True}
