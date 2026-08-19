from django.conf import settings
from django.core.management.commands.migrate import Command as MigrateCommand


class Command(MigrateCommand):
    help = MigrateCommand.help + " (Wrapped to inject --lock-timeout for PostgreSQL)"

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--lock-timeout",
            type=int,
            help="PostgreSQL lock timeout in milliseconds (overrides DATABASE_LOCK_TIMEOUT)",
        )

    def handle(self, *args, **options):
        timeout = options.get("lock_timeout")
        if timeout is None:
            timeout = getattr(settings, "DATABASE_LOCK_TIMEOUT", 5000)

        # Set lock_timeout via signal upon connection creation to avoid startup option
        # parameter errors on connection poolers (e.g. PgBouncer / Neon pooler).
        from django.db.backends.signals import connection_created

        def set_lock_timeout(sender, connection=None, **kwargs):
            if connection and "postgresql" in connection.settings_dict.get(
                "ENGINE", ""
            ):
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(f"SET lock_timeout = '{timeout}ms';")
                except Exception:
                    pass

        connection_created.connect(set_lock_timeout)

        super().handle(*args, **options)
