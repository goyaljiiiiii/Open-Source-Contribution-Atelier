"""
Ed25519 certificate payload signing and verification.

Loads a private key from ``settings.CERT_SIGNING_PRIVATE_KEY_PEM`` or generates
an ephemeral development key pair stored in process memory.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_ephemeral_key_path: Path | None = None
_private_key = None
_public_key = None


def _canonical_json(payload: dict[str, Any]) -> bytes:
    """Deterministic JSON encoding for signing."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _load_or_generate_keys():
    """Load Ed25519 keys from settings or create ephemeral dev keys."""
    global _private_key, _public_key, _ephemeral_key_path

    if _private_key is not None and _public_key is not None:
        return _private_key, _public_key

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )

    pem = getattr(settings, "CERT_SIGNING_PRIVATE_KEY_PEM", "") or ""
    if pem:
        _private_key = serialization.load_pem_private_key(
            pem.encode("utf-8") if isinstance(pem, str) else pem,
            password=None,
        )
        _public_key = _private_key.public_key()
        return _private_key, _public_key

    _private_key = Ed25519PrivateKey.generate()
    _public_key = _private_key.public_key()

    # Persist ephemeral dev key to /tmp for cross-process verification in dev.
    try:
        tmp_dir = Path(tempfile.gettempdir()) / "contribution_atelier"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        _ephemeral_key_path = tmp_dir / "cert_signing_dev.pem"
        pem_bytes = _private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        _ephemeral_key_path.write_bytes(pem_bytes)
        logger.warning(
            "Generated ephemeral Ed25519 signing key at %s (dev only)",
            _ephemeral_key_path,
        )
    except OSError as exc:
        logger.warning("Could not persist ephemeral signing key: %s", exc)

    return _private_key, _public_key


def get_public_key_pem() -> str:
    """Return the active signing public key in PEM format."""
    from cryptography.hazmat.primitives import serialization

    _, public_key = _load_or_generate_keys()
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem.decode("utf-8")


def _public_key_fingerprint(public_key) -> str:
    from cryptography.hazmat.primitives import serialization

    raw = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return hashlib.sha256(raw).hexdigest()


def sign_certificate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Sign *payload* with Ed25519 and return signature metadata.

    Returns a dict containing the original payload fields plus:
    ``signature`` (base64), ``public_key_fingerprint``, and ``verification_hash``
    (sha256 of canonical payload + signature).
    """
    private_key, public_key = _load_or_generate_keys()
    message = _canonical_json(payload)
    signature_bytes = private_key.sign(message)
    signature_b64 = base64.b64encode(signature_bytes).decode("ascii")
    fingerprint = _public_key_fingerprint(public_key)
    verification_hash = hashlib.sha256(message + signature_bytes).hexdigest()

    return {
        **payload,
        "signature": signature_b64,
        "public_key_fingerprint": fingerprint,
        "verification_hash": verification_hash,
    }


def verify_signature(
    payload: dict[str, Any],
    signature_b64: str,
    public_key_pem: str,
) -> bool:
    """Verify an Ed25519 signature over the canonical JSON encoding of *payload*."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization

    try:
        public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        signature = base64.b64decode(signature_b64)
        public_key.verify(_canonical_json(payload), signature)
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False
