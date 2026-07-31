#!/usr/bin/env python3
"""
Unit tests for PR Review Checklist Generator.
"""

import unittest
import os
import sys

# Ensure parent directory is in path to import pr_review_checklist
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pr_review_checklist import (
    classify_files,
    generate_checklist_markdown,
    CHECKLIST_MARKER,
)


class TestPRReviewChecklist(unittest.TestCase):

    def test_python_files_classification(self):
        files = ["backend/apps/models.py", "scripts/test.py"]
        cats = classify_files(files)
        self.assertTrue(cats["python"])
        self.assertFalse(cats["frontend"])
        self.assertFalse(cats["docs"])
        self.assertFalse(cats["migrations"])

    def test_frontend_files_classification(self):
        files = ["frontend/src/App.tsx", "frontend/src/index.css", "components/Button.jsx"]
        cats = classify_files(files)
        self.assertFalse(cats["python"])
        self.assertTrue(cats["frontend"])
        self.assertFalse(cats["docs"])
        self.assertFalse(cats["migrations"])

    def test_docs_files_classification(self):
        files = ["docs/API.md", "README.md", "CONTRIBUTING.md"]
        cats = classify_files(files)
        self.assertFalse(cats["python"])
        self.assertFalse(cats["frontend"])
        self.assertTrue(cats["docs"])
        self.assertFalse(cats["migrations"])

    def test_migrations_files_classification(self):
        files = ["backend/apps/migrations/0001_initial.py"]
        cats = classify_files(files)
        self.assertTrue(cats["python"])  # Migration files are also .py files
        self.assertTrue(cats["migrations"])
        self.assertFalse(cats["frontend"])
        self.assertFalse(cats["docs"])

    def test_mixed_files(self):
        files = [
            "backend/apps/views.py",
            "frontend/src/main.ts",
            "docs/SETUP.md",
            "backend/apps/migrations/0002_update.py",
        ]
        cats = classify_files(files)
        self.assertTrue(cats["python"])
        self.assertTrue(cats["frontend"])
        self.assertTrue(cats["docs"])
        self.assertTrue(cats["migrations"])

    def test_uncategorized_files(self):
        files = [".gitignore", "docker-compose.yml", ".env.example"]
        cats = classify_files(files)
        self.assertFalse(cats["python"])
        self.assertFalse(cats["frontend"])
        self.assertFalse(cats["docs"])
        self.assertFalse(cats["migrations"])

        md = generate_checklist_markdown(files)
        self.assertIn("No specific automated checklist items required", md)
        self.assertIn(CHECKLIST_MARKER, md)

    def test_required_checklist_items_strings(self):
        # Python
        py_md = generate_checklist_markdown(["app.py"])
        self.assertIn("Run black and isort", py_md)
        self.assertIn("Write/update tests", py_md)

        # Frontend
        fe_md = generate_checklist_markdown(["frontend/App.tsx"])
        self.assertIn("Run npm run lint", fe_md)
        self.assertIn("Check mobile responsiveness", fe_md)

        # Docs
        docs_md = generate_checklist_markdown(["docs/guide.md"])
        self.assertIn("Verify links work", docs_md)
        self.assertIn("Check spelling", docs_md)

        # Migrations
        mig_md = generate_checklist_markdown(["backend/migrations/0001.py"])
        self.assertIn("Test rollback", mig_md)

    def test_markdown_marker(self):
        md = generate_checklist_markdown(["app.py"])
        self.assertTrue(md.startswith(CHECKLIST_MARKER))


if __name__ == "__main__":
    unittest.main()
