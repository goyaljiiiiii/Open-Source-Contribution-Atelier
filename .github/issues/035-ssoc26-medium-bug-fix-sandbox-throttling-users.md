# Fix sandbox throttling for authenticated vs unauthenticated users

Sandbox endpoints appear to throttle differently than expected.

## Task
- Inspect throttling logic for sandbox.
- Align behavior with documented expectations.
- Add tests covering both auth states.

## Acceptance criteria
- Authenticated users aren’t unfairly throttled.
- Tests added.

Labels: ssoc26, medium, bug

