#!/usr/bin/env python3
"""
PR Review Checklist Generator

Generates an automated review checklist for Pull Requests based on modified files.
"""

import sys
import json
import re
import argparse
from typing import List, Dict


# Fix Windows stdout encoding issue if needed
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


CHECKLIST_MARKER = "<!-- pr-review-checklist -->"


def classify_files(files: List[str]) -> Dict[str, bool]:
    """
    Classifies a list of file paths into change categories.
    
    Categories:
    - python: .py files
    - frontend: frontend/ directory or .js, .jsx, .ts, .tsx, .vue, .svelte, .css, .scss, .html extensions
    - docs: docs/ directory or .md files, doc templates
    - migrations: files in a migrations/ directory
    """
    categories = {
        "python": False,
        "frontend": False,
        "docs": False,
        "migrations": False,
    }

    for path in files:
        normalized = path.replace("\\", "/").strip()
        if not normalized:
            continue

        # Migrations check
        if "/migrations/" in normalized or normalized.startswith("migrations/"):
            categories["migrations"] = True

        # Python check (.py files)
        if normalized.endswith(".py"):
            categories["python"] = True

        # Frontend check
        if (
            normalized.startswith("frontend/")
            or re.search(r"\.(jsx?|tsx?|vue|svelte|css|scss|html)$", normalized, re.IGNORECASE)
        ):
            categories["frontend"] = True

        # Docs check
        if (
            normalized.startswith("docs/")
            or normalized.endswith(".md")
            or re.search(r"/(README|CONTRIBUTING|LICENSE|SECURITY|AGENTS)(\.md)?$", normalized, re.IGNORECASE)
            or re.search(r"^(README|CONTRIBUTING|LICENSE|SECURITY|AGENTS)(\.md)?$", normalized, re.IGNORECASE)
        ):
            categories["docs"] = True

    return categories


def generate_checklist_markdown(files: List[str]) -> str:
    """
    Generates markdown content for the PR review checklist based on modified files.
    """
    cats = classify_files(files)

    sections = []

    if cats["python"]:
        sections.append(
            "### 🐍 Python Changes\n"
            "- [ ] Run black and isort\n"
            "- [ ] Write/update tests"
        )

    if cats["frontend"]:
        sections.append(
            "### 🎨 Frontend Changes\n"
            "- [ ] Run npm run lint\n"
            "- [ ] Check mobile responsiveness"
        )

    if cats["docs"]:
        sections.append(
            "### 📚 Documentation Changes\n"
            "- [ ] Verify links work\n"
            "- [ ] Check spelling"
        )

    if cats["migrations"]:
        sections.append(
            "### 🗄️ Database Migrations\n"
            "- [ ] Test rollback"
        )

    if not sections:
        body_content = (
            "No specific automated checklist items required for these file changes.\n"
            "- [ ] General code quality and CI checks pass"
        )
    else:
        body_content = "\n\n".join(sections)

    return (
        f"{CHECKLIST_MARKER}\n"
        f"## 📋 Automated PR Review Checklist\n\n"
        f"{body_content}\n\n"
        f"---\n"
        f"> 💡 *This checklist was automatically generated based on modified files in this PR.*"
    )


def main():
    parser = argparse.ArgumentParser(description="Generate PR Review Checklist")
    parser.add_argument(
        "--files",
        nargs="*",
        default=[],
        help="List of changed file paths",
    )
    parser.add_argument(
        "--json-files",
        type=str,
        default="",
        help="JSON array of changed file paths as string",
    )
    parser.add_argument(
        "--input-file",
        type=str,
        default="",
        help="Path to JSON file containing array of changed file paths",
    )
    args = parser.parse_args()

    files = list(args.files)
    if args.json_files:
        try:
            parsed = json.loads(args.json_files)
            if isinstance(parsed, list):
                files.extend([str(f) for f in parsed])
        except Exception as e:
            print(f"Error parsing json-files: {e}", file=sys.stderr)

    if args.input_file:
        try:
            with open(args.input_file, "r", encoding="utf-8") as f:
                parsed = json.load(f)
                if isinstance(parsed, list):
                    files.extend([str(item) for item in parsed])
        except Exception as e:
            print(f"Error reading input-file: {e}", file=sys.stderr)

    checklist_md = generate_checklist_markdown(files)
    print(checklist_md)


if __name__ == "__main__":
    main()
