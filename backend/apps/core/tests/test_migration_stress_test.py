import json
from io import StringIO
from django.core.management import call_command
from django.test import TestCase


class MigrationStressTestCommandTest(TestCase):
    def test_stress_test_migrations_terminal_output(self):
        out = StringIO()
        call_command(
            "stress_test_migrations",
            app="progress",
            target_rows=1000,
            stdout=out,
        )
        output = out.getvalue()
        self.assertIn("Migration Stress Test Report", output)
        self.assertIn("progress", output)
        self.assertIn("PASSED", output)

    def test_stress_test_migrations_json_output(self):
        out = StringIO()
        call_command(
            "stress_test_migrations",
            app="progress",
            target_rows=25000,
            json=True,
            stdout=out,
        )
        output = out.getvalue()
        data = json.loads(output)

        self.assertEqual(data["app"], "progress")
        self.assertEqual(data["simulated_dataset_rows"], 25000)
        self.assertIn("recommendations", data)
        self.assertTrue(len(data["recommendations"]) > 0)

    def test_stress_test_migrations_dry_run_flag(self):
        out = StringIO()
        call_command(
            "stress_test_migrations",
            app="accounts",
            dry_run=True,
            json=True,
            stdout=out,
        )
        data = json.loads(out.getvalue())
        self.assertTrue(data["dry_run"])
        self.assertEqual(data["app"], "accounts")
