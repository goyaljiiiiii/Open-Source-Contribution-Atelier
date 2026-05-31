# Add resilient notification delivery with retry/backoff

Notifications may fail transiently, leaving users without updates.

## Task
- Inspect notifications sending flow and error handling.
- Implement retry with exponential backoff for transient failures.
- Ensure failures are logged with enough context.

## Acceptance criteria
- Transient failures are retried.
- No infinite retry loops.

Labels: ssoc26, hard, enhancement

