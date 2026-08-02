import base64
import hashlib
import hmac
from functools import wraps
from typing import List, Tuple, Union

from cryptography.fernet import Fernet
from django.conf import settings
from django.http import JsonResponse


def get_fernet_cipher() -> Fernet:
    """
    Derives a 32-byte key for Fernet symmetric encryption from Django settings.SECRET_KEY.
    """
    key = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    return Fernet(fernet_key)


def encrypt_secret(plain_text: str) -> str:
    """
    Encrypts a plaintext webhook secret using Fernet.
    """
    if not plain_text:
        return ""
    cipher = get_fernet_cipher()
    return cipher.encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_secret(encrypted_text: str) -> str:
    """
    Decrypts an encrypted webhook secret using Fernet.
    """
    if not encrypted_text:
        return ""
    cipher = get_fernet_cipher()
    return cipher.decrypt(encrypted_text.encode("utf-8")).decode("utf-8")


def compute_signature(secret: str, payload: bytes) -> str:
    """
    Computes a SHA-256 HMAC signature for the given payload using the provided secret.
    """
    return hmac.new(
        secret.encode("utf-8"), msg=payload, digestmod=hashlib.sha256
    ).hexdigest()


def verify_signature(
    secret: Union[str, List[Union[str, Tuple[str, str]]], Tuple[Union[str, Tuple[str, str]], ...]],
    payload: bytes,
    signature: str,
) -> bool:
    """
    Verifies that the provided signature matches the computed HMAC signature.
    Uses constant-time comparison to prevent timing attacks.
    Supports secrets as strings or (key_id, secret) tuples.
    """
    if not signature:
        return False

    clean_sig = signature.removeprefix("sha256=") if signature.startswith("sha256=") else signature

    secrets_list = [secret] if isinstance(secret, (str, tuple)) and not (isinstance(secret, tuple) and len(secret) == 2 and isinstance(secret[0], str) and isinstance(secret[1], str)) else list(secret) if isinstance(secret, (list, tuple)) else [secret]

    for item in secrets_list:
        sec = item[1] if isinstance(item, (tuple, list)) and len(item) == 2 else item
        if isinstance(sec, str) and sec:
            expected_signature = compute_signature(sec, payload)
            if hmac.compare_digest(expected_signature, clean_sig):
                return True
    return False


def require_webhook_signature(secret, header_name="HTTP_X_SIGNATURE"):
    """
    View decorator to enforce HMAC signature verification on incoming webhooks.

    :param secret: A string or a callable that takes the `request` and returns a string secret or list of secrets.
    :param header_name: The Django META key for the header (e.g. 'HTTP_X_SIGNATURE' for 'X-Signature').
    """

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # Extract payload
            payload = request.body
            if not payload:
                return JsonResponse({"error": "Empty payload"}, status=400)

            # Extract signature
            signature = request.META.get(header_name)
            if not signature:
                return JsonResponse({"error": "Missing signature header"}, status=403)

            # Determine secret
            actual_secret = secret(request) if callable(secret) else secret
            if not actual_secret:
                return JsonResponse(
                    {"error": "Configuration error: Missing secret"}, status=500
                )

            # Verify
            if not verify_signature(actual_secret, payload, signature):
                return JsonResponse({"error": "Invalid signature"}, status=403)

            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
