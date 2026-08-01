from django.apps import apps
from django.core.management.base import BaseCommand

from apps.core.fields import EncryptedFieldMixin


class Command(BaseCommand):
    help = "Rotates encryption keys for all EncryptedCharField and EncryptedTextField fields."

    def add_arguments(self, parser):
        parser.add_argument(
            "--rotate-key",
            action="store_true",
            help="Confirm that you want to rotate keys (reads using available keys, writes with the primary key).",
        )

    def handle(self, *args, **options):
        if not options["rotate_key"]:
            self.stdout.write(
                self.style.ERROR("Must provide --rotate-key flag to proceed.")
            )
            return

        models_to_update = []
        for model in apps.get_models():
            encrypted_fields = [
                f
                for f in model._meta.get_fields()
                if isinstance(f, EncryptedFieldMixin)
            ]
            if encrypted_fields:
                models_to_update.append((model, encrypted_fields))

        if not models_to_update:
            self.stdout.write(
                self.style.SUCCESS("No models with encrypted fields found.")
            )
            return

        total_rotated = 0
        for model, fields in models_to_update:
            self.stdout.write(f"Rotating keys for {model.__name__}...")
            count = 0

            # Use iterator to avoid loading entire table into memory
            for instance in model.objects.all().iterator(chunk_size=1000):
                # Saving the instance re-triggers get_prep_value on the encrypted fields,
                # which will use the new primary key for encryption.
                instance.save()
                count += 1

            self.stdout.write(
                self.style.SUCCESS(f"Rotated {count} records for {model.__name__}")
            )
            total_rotated += count

        self.stdout.write(
            self.style.SUCCESS(
                f"Finished rotating keys for {total_rotated} total records."
            )
        )
