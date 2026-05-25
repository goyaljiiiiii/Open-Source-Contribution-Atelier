#!/usr/bin/env python3
"""
Create GitHub issues from markdown files in `.github/issues/`.

Usage:
  GITHUB_TOKEN=ghp_xxx python scripts/create_github_issues.py

This script will read each `.md` file, use the first line as the title,
the rest as body, and parse a "Labels:" line to attach labels.
"""
import os
import re
import requests
from pathlib import Path

TOKEN = os.getenv("GITHUB_TOKEN")
if not TOKEN:
    print("GITHUB_TOKEN not set. Export a token with repo scope and re-run.")
    exit(1)

repo_url = os.popen('git config --get remote.origin.url').read().strip()
# Try to derive owner/repo from remote
m = re.search(r"[:/]([^/]+/[^/]+)(?:\.git)?$", repo_url)
if not m:
    print("Could not determine repo from git remote. Set REPO env (owner/repo).")
    repo = os.getenv("REPO")
else:
    repo = m.group(1)

if not repo:
    print("Repository not specified. Exiting.")
    exit(1)

API = f"https://api.github.com/repos/{repo}/issues"
HEADERS = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json"}

issues_dir = Path(".github/issues")
files = sorted(issues_dir.glob("*.md"))
if not files:
    print("No issue drafts found in .github/issues/")
    exit(0)

for p in files:
    text = p.read_text()
    lines = text.strip().splitlines()
    if not lines:
        continue
    title = lines[0].lstrip('# ').strip()
    body = '\n'.join(lines[1:]).strip()
    # parse Labels: line
    labels_match = re.search(r"Labels:\s*(.+)", text)
    labels = []
    if labels_match:
        labels = [l.strip() for l in labels_match.group(1).split(',') if l.strip()]

    payload = {"title": title, "body": body, "labels": labels}
    resp = requests.post(API, json=payload, headers=HEADERS)
    if resp.status_code in (200, 201):
        print(f"Created: {title}")
    else:
        print(f"Failed {p.name}: {resp.status_code} {resp.text}")
