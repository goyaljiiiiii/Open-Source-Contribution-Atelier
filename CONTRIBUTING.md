# Contributing

Thanks for contributing to Open Source Contribution Atelier.

## Principles

- Keep contributions beginner-friendly and well-documented
- Prefer safe defaults and avoid introducing secrets into code
- Add tests for backend and frontend changes when practical
- Discuss large architectural changes before implementation

## Setup

Use the instructions in [README.md](README.md) to run the project locally.

## Getting Started for SSOC

Welcome to Open Source Contribution Atelier! If you're participating through SSOC, follow these steps to get started.

### Contribution Path

1. Fork the repository.
2. Clone your fork locally.
3. Follow the setup instructions in the README.
4. Explore open issues and choose one that matches your interests.
5. Comment on the issue to request assignment.
6. Create a new branch from `main`.
7. Make your changes and test them locally.
8. Open a Pull Request with a clear description.

### Suggested First Tasks

New contributors can start with:

- Documentation improvements
- README enhancements
- Fixing typos and broken links
- Improving setup instructions
- Small frontend UI improvements
- Adding tests for existing features

### Beginner-Friendly Issues

Look for issues labeled:

- `good first issue`
- `documentation`
- `enhancement`

### Mentorship Expectations

- Read the issue carefully before starting.
- Ask questions if requirements are unclear.
- Keep pull requests focused on a single issue.
- Respond to review feedback constructively.
- Follow project coding and documentation standards.

### Communication

Use GitHub Issues and Pull Request discussions for questions, updates, and reviews.

### Contribution Timeline

Issue Selection → Assignment → Development → Pull Request → Review → Merge

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

## Lesson Contributions & Issues

- To propose a new lesson or exercise, open an issue titled `lesson: <short title>` and include:
	- a short summary, learning objectives, and the expected exercise command(s)
	- suggested order/placement in the track
	- any files or assets required
- If you want to work on the lesson yourself, comment on the issue and open a branch prefixed with `lesson/`.
- Use `python manage.py seed_lessons` to load the example lessons locally; maintainers will review and promote community-submitted lessons.

## Issue Hygiene For Maintainers

- Keep issue labels consistent: `bug`, `enhancement`, `curriculum`, `good first issue`, `needs-triage`, `blocked`.
- Close duplicate/outdated issues with a short reason and a pointer to the active issue.
- Convert vague issues into actionable tasks by adding scope and acceptance criteria.
- If an issue is stale for >30 days with no owner, either re-scope or close it with a reopen note.
