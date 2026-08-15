import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def get_encryption_keys():
    key_setting = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if not key_setting:
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY must be set in settings.")

    # Support for key rotation: allow setting to be a list or a string
    if isinstance(key_setting, str):
        keys = [key_setting]
    else:
        keys = key_setting

    parsed_keys = []
    for k in keys:
        try:
            # The issue specified generating keys with Fernet.generate_key()
            # which produces a 32-byte URL-safe base64 string.
            decoded = base64.urlsafe_b64decode(k)
            if len(decoded) != 32:
                raise ValueError("Key must be 32 bytes.")
            parsed_keys.append(decoded)
        except Exception as e:
            raise ImproperlyConfigured(
                f"FIELD_ENCRYPTION_KEY must be a valid base64 encoded 32-byte string: {e}"
            )
    return parsed_keys


def encrypt_value(value: str) -> str:
    if not value:
        return value
    keys = get_encryption_keys()
    aesgcm = AESGCM(keys[0])
    nonce = os.urandom(12)  # 96-bit nonce
    ct = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    # Prefix with 'enc:' to easily distinguish encrypted vs plaintext strings during migration
    return "enc:" + base64.urlsafe_b64encode(nonce + ct).decode("ascii")


def decrypt_value(value: str) -> str:
    if not value or not isinstance(value, str):
        return value

    if not value.startswith("enc:"):
        # If it doesn't have the encryption prefix, it's plaintext (e.g. before migration)
        return value

    keys = get_encryption_keys()
    raw_value = value[4:]  # strip 'enc:' prefix

    try:
        data = base64.urlsafe_b64decode(raw_value.encode("ascii"))
    except Exception:
        return value

    nonce = data[:12]
    ct = data[12:]

    for key in keys:
        try:
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(nonce, ct, None)
            return plaintext.decode("utf-8")
        except Exception:
            continue

    # If decryption fails for all keys, it might be corrupt, but we fallback
    return value


class EncryptedFieldMixin:
    def get_internal_type(self):
        # Always use TextField for DB storage since ciphertext is longer than plaintext
        return "TextField"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt_value(value)

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_value(value)


class EncryptedCharField(EncryptedFieldMixin, models.CharField):
    pass


class EncryptedTextField(EncryptedFieldMixin, models.TextField):
    pass
