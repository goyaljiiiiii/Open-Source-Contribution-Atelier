"""
TOTP (RFC 6238) and 2FA recovery backup codes helper module.
Implemented using standard Python library (hmac, hashlib, struct, base64, secrets, time).
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import urllib.parse
from typing import List, Tuple, Optional


def generate_totp_secret(length: int = 32) -> str:
    """Generate a random 32-character base32 secret key."""
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_totp_code(
    secret: str, time_step: int = 30, digits: int = 6, for_time: Optional[float] = None
) -> str:
    """
    Generate a 6-digit TOTP code for the given secret key at specified time.
    Follows RFC 6238 / RFC 4226 HMAC-SHA1 algorithm.
    """
    if for_time is None:
        for_time = time.time()

    secret_clean = secret.upper().replace(" ", "").rstrip("=")
    missing_padding = len(secret_clean) % 8
    if missing_padding:
        secret_clean += "=" * (8 - missing_padding)

    try:
        key = base64.b32decode(secret_clean, casefold=True)
    except Exception:
        key = secret_clean.encode("utf-8")

    counter = int(for_time // time_step)
    msg = struct.pack(">Q", counter)

    hmac_hash = hmac.new(key, msg, hashlib.sha1).digest()
    offset = hmac_hash[-1] & 0x0F
    code_int = (
        struct.unpack(">I", hmac_hash[offset : offset + 4])[0] & 0x7FFFFFFF
    ) % (10**digits)

    return str(code_int).zfill(digits)


def verify_totp_code(secret: str, code: str, window: int = 1) -> bool:
    """
    Verify a TOTP 6-digit code against a secret key within a time drift window (default +/- 1 period = 30s).
    """
    if not secret or not code:
        return False

    clean_code = str(code).strip().replace(" ", "")
    if not clean_code.isdigit() or len(clean_code) != 6:
        return False

    now = time.time()
    for delta in range(-window, window + 1):
        expected = generate_totp_code(secret, for_time=now + delta * 30)
        if hmac.compare_digest(expected, clean_code):
            return True

    return False


def get_provisioning_uri(username: str, secret: str, issuer: str = "Atelier") -> str:
    """Return an otpauth:// URI for scanning into Google Authenticator/Authy/1Password."""
    label = urllib.parse.quote(f"{issuer}:{username}")
    issuer_quoted = urllib.parse.quote(issuer)
    clean_secret = secret.upper().replace(" ", "")
    return f"otpauth://totp/{label}?secret={clean_secret}&issuer={issuer_quoted}"


def generate_backup_codes(count: int = 10) -> Tuple[List[str], List[str]]:
    """
    Generate recovery backup codes.
    Returns (plain_codes, hashed_codes).
    Each code is an 8-character hexadecimal string formatted as XXXX-XXXX for user display.
    """
    plain_codes = []
    hashed_codes = []

    for _ in range(count):
        raw = secrets.token_hex(4)  # 8 hex chars
        formatted = f"{raw[:4]}-{raw[4:]}"
        hashed = hashlib.sha256(raw.lower().encode("utf-8")).hexdigest()

        plain_codes.append(formatted)
        hashed_codes.append(hashed)

    return plain_codes, hashed_codes


def verify_and_consume_backup_code(totp_device, code: str) -> bool:
    """
    Verify if a backup code is valid for the user's TOTP device.
    If valid, consumes the backup code (deletes its hash from DB) and returns True.
    """
    if not totp_device or not totp_device.is_enabled or not totp_device.backup_codes:
        return False

    clean_code = str(code).strip().lower().replace("-", "").replace(" ", "")
    if len(clean_code) != 8:
        return False

    code_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()

    if code_hash in totp_device.backup_codes:
        updated_codes = [c for c in totp_device.backup_codes if c != code_hash]
        totp_device.backup_codes = updated_codes
        totp_device.save(update_fields=["backup_codes"])
        return True

    return False
