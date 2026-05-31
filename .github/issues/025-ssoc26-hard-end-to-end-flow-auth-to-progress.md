# Build E2E flow test: auth → lesson → progress

Current automated tests cover components/services separately, but end-to-end coverage is limited.

## Task
- Add an end-to-end test (or extend existing harness) for:
  1) user signup/login
  2) opening a lesson page
  3) completing a lesson step
  4) verifying progress update

## Acceptance criteria
- E2E test runs in CI or can be run locally.
- Test reliably asserts expected behavior.

Labels: ssoc26, hard, enhancement

