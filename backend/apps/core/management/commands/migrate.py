from django.core.management.commands.migrate import Command as MigrateCommand
from django.conf import settings


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

        # Inject lock_timeout into the database options for postgresql
        for db_name, db_config in settings.DATABASES.items():
            engine = db_config.get("ENGINE", "")
            if "postgresql" in engine:
                options_dict = db_config.setdefault("OPTIONS", {})
                current_options = options_dict.get("options", "")

                timeout_option = f"-c lock_timeout={timeout}ms"
                if current_options:
                    options_dict["options"] = f"{current_options} {timeout_option}"
                else:
                    options_dict["options"] = timeout_option

        super().handle(*args, **options)
