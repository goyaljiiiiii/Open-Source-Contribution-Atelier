# Fix rate limiting edge case in challenges views

Some users report intermittent 429/500 behavior when repeatedly submitting the same challenge request quickly.

## Task
- Reproduce the issue (add a small test or use the existing test harness).
- Inspect the throttling logic in the challenges app.
- Fix the edge case so that repeated submissions either:
  - consistently return 429 when throttled, or
  - consistently succeed when not throttled.

## Acceptance criteria
- Add/adjust unit tests covering the edge case.
- Ensure no regressions in existing sandbox/challenge tests.
- Update any relevant docs/comments.

Labels: ssoc26, easy, bug

