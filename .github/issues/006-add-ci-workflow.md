# Harden CI: add lint, tests, and preview build

Extend the existing CI workflow to include linting steps (ESLint, Flake8), run unit tests on pull requests, and optionally publish a preview build artifact.

Acceptance criteria:
- Add lint job for `frontend` (ESLint) and `backend` (flake8 or pylint)
- Fail on lint errors in PRs

Labels: SSOC, infra
