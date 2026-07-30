import logging
import secrets
import time

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Generate a new HMAC-SHA256 webhook signing key, prepend it to settings.WEBHOOK_SIGNING_KEYS "
        "as the active key, and emit a deprecation notice for the previously active key."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--key-id",
            type=str,
            dest="key_id",
            default=None,
            help="Custom key ID for the new signing key (default: auto-generated timestamp/hex ID).",
        )
        parser.add_argument(
            "--secret",
            type=str,
            dest="secret",
            default=None,
            help="Custom secret string for the new signing key (default: 64-char hex secret).",
        )

    def handle(self, *args, **options):
        custom_key_id = options.get("key_id")
        custom_secret = options.get("secret")

        key_ring = getattr(settings, "WEBHOOK_SIGNING_KEYS", [])
        if not isinstance(key_ring, list):
            key_ring = list(key_ring)

        old_active_key_id = key_ring[0][0] if len(key_ring) > 0 else None

        new_key_id = custom_key_id or f"key_{int(time.time())}_{secrets.token_hex(3)}"
        new_secret = custom_secret or secrets.token_hex(32)

        new_pair = (new_key_id, new_secret)
        key_ring.insert(0, new_pair)
        settings.WEBHOOK_SIGNING_KEYS = key_ring

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully rotated webhook signing key. Active Key ID: '{new_key_id}'"
            )
        )

        if old_active_key_id:
            notice = (
                f"DEPRECATION NOTICE: Key '{old_active_key_id}' is now deprecated and moved to fallback verification. "
                f"All incoming requests signed with '{old_active_key_id}' will continue to be accepted during rotation, "
                f"but outgoing signatures will use active key '{new_key_id}'."
            )
            self.stdout.write(self.style.WARNING(notice))
            logger.warning(notice)
        else:
            self.stdout.write(
                self.style.NOTICE("No prior active key was present in the key ring.")
            )

        self.stdout.write(f"New Key Secret: {new_secret}")
