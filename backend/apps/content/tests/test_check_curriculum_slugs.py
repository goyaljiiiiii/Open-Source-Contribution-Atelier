import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import CommandError, call_command
from django.test import TestCase

from apps.content.management.commands.check_curriculum_slugs import (
    diff_slugs,
    extract_curriculum_slugs,
)
from apps.content.models import Lesson


class CheckCurriculumSlugsTests(TestCase):
    def test_extract_curriculum_slugs(self):
        sample_data = {
            "modules": [
                {
                    "id": "module-1",
                    "lessons": [
                        {"slug": "intro-git"},
                        {"slug": "git-branches"},
                    ],
                },
                {
                    "id": "module-2",
                    "lessons": [
                        {"slug": "merge-conflicts"},
                        {"slug": "intro-git"},  # duplicate
                    ],
                },
            ]
        }
        slugs = extract_curriculum_slugs(sample_data)
        self.assertEqual(slugs, ["git-branches", "intro-git", "merge-conflicts"])

    def test_diff_slugs_detects_mismatches(self):
        curriculum = ["slug-a", "slug-b"]
        db_slugs = ["slug-b", "slug-c"]

        diff = diff_slugs(curriculum, db_slugs)
        self.assertEqual(diff["missing_in_api"], ["slug-a"])
        self.assertEqual(diff["missing_in_curriculum"], ["slug-c"])

    def test_command_detects_drift_and_outputs_json(self):
        Lesson.objects.create(title="DB Lesson", slug="db-lesson-1", order=1)

        with TemporaryDirectory() as tmpdir:
            curriculum_file = Path(tmpdir) / "curriculum.json"
            curriculum_file.write_text(
                json.dumps(
                    {
                        "modules": [
                            {
                                "id": "m1",
                                "lessons": [{"slug": "curriculum-lesson-1"}],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            out = StringIO()
            call_command(
                "check_curriculum_slugs",
                curriculum=str(curriculum_file),
                format="json",
                stdout=out,
            )
            payload = json.loads(out.getvalue())

            self.assertTrue(payload["has_drift"])
            self.assertEqual(payload["missing_in_api"], ["curriculum-lesson-1"])
            self.assertEqual(payload["missing_in_curriculum"], ["db-lesson-1"])

    def test_command_fails_on_drift_when_flag_provided(self):
        with TemporaryDirectory() as tmpdir:
            curriculum_file = Path(tmpdir) / "curriculum.json"
            curriculum_file.write_text(
                json.dumps(
                    {"modules": [{"id": "m1", "lessons": [{"slug": "missing-slug"}]}]}
                ),
                encoding="utf-8",
            )

            with self.assertRaises(CommandError):
                call_command(
                    "check_curriculum_slugs",
                    curriculum=str(curriculum_file),
                    fail_on_drift=True,
                )
