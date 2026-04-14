# Contributing

Thanks for contributing to Open Source Contribution Atelier.

## Principles

- Keep contributions beginner-friendly and well-documented
- Prefer safe defaults and avoid introducing secrets into code
- Add tests for backend and frontend changes when practical
- Discuss large architectural changes before implementation

## Setup

Use the instructions in [README.md](/home/nandini/Documents/projevt/README.md) to run the project locally.

## Branching

- Never commit directly to `main`
- Start every change by creating a new branch from `main`
- Use branch names such as `feature/terminal-feedback`, `fix/auth-tests`, or `docs/setup-guide`
- Use clear commit messages
- Open focused pull requests

Recommended commands:

```bash
git pull origin main
git switch -c feature/short-description
```

## Pull Requests

- Describe the problem and the chosen approach
- Include screenshots for UI changes
- Mention any schema or environment updates
- Confirm tests run locally
- Push your branch and open the PR from that branch into `main`

## Code Style

- Python: Black-compatible formatting, modular Django apps
- TypeScript: ESLint + Prettier, accessible React components
- Avoid large unrelated refactors in feature PRs

## Security

- Never commit `.env` files or tokens
- Do not add code that executes untrusted shell input
- Route exercise validation through the sandbox verifier service
- Do not commit generated artifacts such as `node_modules/`, `dist/`, or local virtual environments
