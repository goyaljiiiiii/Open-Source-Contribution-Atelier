"""
Check dependency scan reports against a vulnerability allowlist.

Usage:
    python backend/scripts/check_dependency_allowlist.py \\
        --reports-dir reports/ \\
        --allowlist backend/scripts/vuln-allowlist.json \\
        --output vuln-report-consolidated.json

Exits with code 1 if any HIGH/CRITICAL vulnerability not in the allowlist is found.
"""

import argparse
import csv
import json
from datetime import date
from pathlib import Path


def load_allowlist(path):
    with open(path) as f:
        data = json.load(f)
    allowed_ids = {}
    for entry in data.get("allowed_cves", []):
        cve_id = entry.get("id", "").upper()
        reason = entry.get("reason", "")
        expires = entry.get("expires")
        if expires and date.fromisoformat(expires) < date.today():
            continue
        allowed_ids[cve_id] = reason
    allowed_pkgs = {p.get("name"): p.get("reason", "") for p in data.get("allowed_packages", [])}
    return allowed_ids, allowed_pkgs


def parse_pip_audit_report(path):
    vulnerabilities = []
    try:
        with open(path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return vulnerabilities

    for dep in data.get("dependencies", []):
        for vuln in dep.get("vulnerabilities", []):
            vulnerabilities.append({
                "id": vuln.get("id", "UNKNOWN"),
                "package": dep.get("name", "unknown"),
                "installed_version": dep.get("version", ""),
                "severity": vuln.get("severity", "UNKNOWN").upper(),
                "fix_version": vuln.get("fix_versions", [None])[0] if vuln.get("fix_versions") else None,
                "source": "pip-audit",
            })
    return vulnerabilities


def parse_npm_audit_report(path):
    vulnerabilities = []
    try:
        with open(path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return vulnerabilities

    for advisory_id, advisory in data.get("advisories", {}).items():
        severity = advisory.get("severity", "unknown").upper()
        vulnerabilities.append({
            "id": advisory.get("github_advisory_id", f"GHSA-{advisory_id}"),
            "package": advisory.get("module_name", "unknown"),
            "installed_version": advisory.get("found_version", ""),
            "severity": severity,
            "fix_version": advisory.get("patched_versions", ""),
            "source": "npm-audit",
        })
    return vulnerabilities


def parse_grype_report(path):
    vulnerabilities = []
    try:
        with open(path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return vulnerabilities

    for match in data.get("matches", []):
        vuln = match.get("vulnerability", {})
        artifact = match.get("artifact", {})
        severity = vuln.get("severity", "unknown").upper()
        vulnerabilities.append({
            "id": vuln.get("id", "UNKNOWN"),
            "package": artifact.get("name", "unknown"),
            "installed_version": artifact.get("version", ""),
            "severity": severity,
            "fix_version": vuln.get("fix", {}).get("versions", [None])[0] if vuln.get("fix") else None,
            "source": "grype",
        })
    return vulnerabilities


def filter_allowlist(vulnerabilities, allowed_ids, allowed_pkgs):
    unallowed = []
    allowed = []
    for v in vulnerabilities:
        cve_id = v["id"].upper()
        pkg_name = v["package"]
        severity = v.get("severity", "UNKNOWN")

        if cve_id in allowed_ids:
            v["allowlist_reason"] = allowed_ids[cve_id]
            allowed.append(v)
        elif pkg_name in allowed_pkgs:
            v["allowlist_reason"] = allowed_pkgs[pkg_name]
            allowed.append(v)
        elif severity in ("HIGH", "CRITICAL"):
            unallowed.append(v)
        else:
            allowed.append(v)
    return unallowed, allowed


def generate_csv_report(unallowed, allowed, output_path):
    fieldnames = [
        "id", "package", "installed_version", "severity",
        "fix_version", "source", "status", "allowlist_reason",
    ]
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for v in unallowed:
            v["status"] = "UNALLOWED"
            writer.writerow(v)
        for v in allowed:
            v["status"] = "ALLOWED"
            writer.writerow(v)


def main():
    parser = argparse.ArgumentParser(description="Check vulnerability reports against allowlist")
    parser.add_argument("--reports-dir", required=True, help="Directory containing scan reports")
    parser.add_argument("--allowlist", required=True, help="Path to allowlist JSON")
    parser.add_argument("--output", default="vuln-report-consolidated.json", help="Output consolidated report path")
    parser.add_argument("--csv", default=None, help="Optional CSV output path")
    args = parser.parse_args()

    reports_dir = Path(args.reports_dir)
    allowed_ids, allowed_pkgs = load_allowlist(args.allowlist)

    all_vulnerabilities = []

    for pip_report in reports_dir.glob("vuln-report-pip*.json"):
        all_vulnerabilities.extend(parse_pip_audit_report(pip_report))
    for npm_report in reports_dir.glob("vuln-report-npm*.json"):
        all_vulnerabilities.extend(parse_npm_audit_report(npm_report))
    for grype_report in reports_dir.glob("vuln-report-grype*.json"):
        all_vulnerabilities.extend(parse_grype_report(grype_report))

    unallowed, allowed = filter_allowlist(all_vulnerabilities, allowed_ids, allowed_pkgs)

    consolidated = {
        "summary": {
            "total_vulnerabilities": len(all_vulnerabilities),
            "unallowed_count": len(unallowed),
            "allowed_count": len(allowed),
            "passed": len(unallowed) == 0,
        },
        "unallowed_vulnerabilities": sorted(unallowed, key=lambda v: (v["severity"], v["id"])),
        "allowed_vulnerabilities": sorted(allowed, key=lambda v: (v["severity"], v["id"])),
    }

    with open(args.output, "w") as f:
        json.dump(consolidated, f, indent=2)

    if args.csv:
        generate_csv_report(unallowed, allowed, args.csv)

    print(f"Total: {len(all_vulnerabilities)}, Unallowed: {len(unallowed)}, Allowed: {len(allowed)}")

    if unallowed:
        print(f"FAIL: {len(unallowed)} HIGH/CRITICAL vulnerabilities not in allowlist")
        for v in unallowed:
            print(f"  [{v['severity']}] {v['id']} in {v['package']} ({v['source']})")
        exit(1)

    print("PASS: No unallowed HIGH/CRITICAL vulnerabilities found")


if __name__ == "__main__":
    main()
