# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Vulnerability Disclosure Process

If you discover a security vulnerability in this project, please follow these steps:

1. **Do not** open a public issue. Instead, email the maintainers directly or use GitHub's private security advisory feature.
2. Provide a clear description of the vulnerability, including steps to reproduce if possible.
3. Allow up to 7 days for an initial response and assessment.

## Scanning Schedule

| Scan           | Cadence   | Tool       | Scope                      |
| -------------- | --------- | ---------- | -------------------------- |
| Dependabot     | Daily     | Dependabot | pip (backend), npm (frontend) |
| Docker         | Weekly    | Dependabot | Backend & frontend base images |
| Grype (SBOM)   | On push, weekly | Grype | Docker image OS & language CVEs |
| pip-audit      | On push   | pip-audit  | Python packages (requirements.txt) |
| npm audit      | On push   | npm audit  | npm packages (frontend) |

## Vulnerability Triage

- **CRITICAL**: Immediate patch within 24 hours.
- **HIGH**: Patch within 7 days.
- **MEDIUM**: Patch within 30 days.
- **LOW**: Patch within 90 days or next release.

## False-Positive Management

Known false-positive CVEs are maintained in `backend/scripts/vuln-allowlist.json`.
Entries include a reason and optional expiry date. Review quarterly.

## Reporting a Vulnerability

Use the GitHub Security Advisory tab ("Report a vulnerability") at:
https://github.com/nandinigoyaldev/Open-Source-Contribution-Atelier/security/advisories
