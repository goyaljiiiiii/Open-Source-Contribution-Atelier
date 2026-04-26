# Security Policy

## Supported Scope

This repository is intended for public collaboration. Please report vulnerabilities responsibly and avoid opening public issues for undisclosed security flaws.

## Reporting

- Email the maintainers or use a private disclosure channel
- Include reproduction steps, impact, and affected paths
- Do not include real secrets or personal data

## Secure Development Notes

- JWT configuration supports production hardening through environment variables
- Exercise verification is pattern-based and intentionally avoids arbitrary command execution
- GitHub OAuth is optional and should be configured only with approved credentials

