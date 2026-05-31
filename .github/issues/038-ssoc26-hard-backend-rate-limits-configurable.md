# Make backend throttling configuration environment-driven

Throttling parameters are hardcoded, making tuning difficult.

## Task
- Locate where throttling rates/time windows are configured.
- Add settings/env vars to configure throttle behavior.
- Document the new variables.

## Acceptance criteria
- Throttle behavior can be adjusted via env vars.
- Tests cover at least one configured scenario.

Labels: ssoc26, hard, enhancement

