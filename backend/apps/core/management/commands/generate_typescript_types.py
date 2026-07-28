import subprocess
import sys
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Generate TypeScript types from the OpenAPI schema."
    def handle(self, *args, **options):
        backend_dir = Path(__file__).resolve().parents[4]
        repo_root = backend_dir.parent
        frontend_dir = repo_root / "frontend"

        schema_path = backend_dir / "schema.yml"
        output_dir = frontend_dir / "src" / "types"
        output_dir.mkdir(parents=True, exist_ok=True)

        output_file = output_dir / "api.d.ts"

        try:
            self.stdout.write("Generating OpenAPI schema...")

            subprocess.run(
                [
                    sys.executable,
                    "manage.py",
                    "spectacular",
                    "--skip-checks",
                    "--file",
                    str(schema_path),
                ],
                cwd=backend_dir,
                check=True,
            )

            self.stdout.write("Generating TypeScript types...")

            subprocess.run(
                [
                    "npx",
                    "openapi-typescript",
                    str(schema_path),
                    "-o",
                    str(output_file),
                ],
                cwd=frontend_dir,
                check=True,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"TypeScript definitions generated at {output_file}"
                )
            )

        except subprocess.CalledProcessError as exc:
            raise CommandError(
                f"Type generation failed: {exc}"
            ) from exc

        finally:
            if schema_path.exists():
                schema_path.unlink()