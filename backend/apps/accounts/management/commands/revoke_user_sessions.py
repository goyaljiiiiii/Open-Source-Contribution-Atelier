from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.accounts.token_rotation import publish_token_revoked

User = get_user_model()


class Command(BaseCommand):
    help = "Revoke all JWT-backed sessions for a user and close active WebSocket connections."

    def add_arguments(self, parser):
        parser.add_argument("user_id", type=int)

    def handle(self, *args, **options):
        user_id = options["user_id"]

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist as exc:
            raise CommandError(f"User {user_id} does not exist.") from exc

        with transaction.atomic():
            profile = getattr(user, "user_profile", None)
            if profile is not None:
                profile.jwt_token_version += 1
                profile.save(update_fields=["jwt_token_version"])

            tokens = OutstandingToken.objects.filter(user=user)
            created = 0
            for token in tokens.iterator():
                _, was_created = BlacklistedToken.objects.get_or_create(token=token)
                created += int(was_created)

        publish_token_revoked(user.pk)

        self.stdout.write(
            self.style.SUCCESS(
                f"Revoked sessions for user {user.pk}; blacklisted {created} JWTs."
            )
        )
