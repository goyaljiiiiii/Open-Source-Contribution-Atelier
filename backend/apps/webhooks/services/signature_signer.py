import hashlib
import hmac
import json
from typing import Union


class HMACSignatureSigner:
    """
    Utility class for computing and verifying SHA-256 HMAC signatures
    for outgoing and incoming webhook HTTP payloads using X-Hub-Signature-256 format.
    """

    HEADER_NAME = "X-Hub-Signature-256"

    @staticmethod
    def sign_payload(secret: str, payload: Union[str, bytes, dict]) -> str:
        """
        Signs a payload string or dict with a secret key using HMAC SHA-256.
        Returns signature string formatted as 'sha256=<hex_digest>'.
        """
        if not secret:
            raise ValueError("Webhook secret key cannot be empty.")

        if isinstance(payload, dict):
            payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        elif isinstance(payload, str):
            payload_bytes = payload.encode("utf-8")
        else:
            payload_bytes = payload

        secret_bytes = secret.encode("utf-8")
        digest = hmac.new(secret_bytes, payload_bytes, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    @staticmethod
    def verify_signature(secret: str, payload: Union[str, bytes, dict], signature_header: str) -> bool:
        """
        Verifies that an incoming header signature matches the expected HMAC-SHA256 signature.
        Uses constant-time comparison to protect against timing attacks.
        """
        if not signature_header or not secret:
            return False

        try:
            expected_sig = HMACSignatureSigner.sign_payload(secret, payload)
            # Support both 'sha256=<hex>' and raw hex signatures
            if signature_header.startswith("sha256="):
                return hmac.compare_digest(expected_sig, signature_header)
            else:
                return hmac.compare_digest(expected_sig.replace("sha256=", ""), signature_header)
        except Exception:
            return False

    @staticmethod
    def generate_webhook_headers(secret: str, event_type: str, payload: dict, attempt: int = 1) -> dict:
        """
        Generates standard HTTP request headers for an outgoing webhook delivery.
        """
        signature = HMACSignatureSigner.sign_payload(secret, payload)
        return {
            "Content-Type": "application/json",
            "User-Agent": "OpenSourceAtelier-Webhook/1.0",
            HMACSignatureSigner.HEADER_NAME: signature,
            "X-Webhook-Signature": signature.replace("sha256=", ""),
            "X-Webhook-Event": event_type,
            "X-Webhook-Attempt": str(attempt),
        }
