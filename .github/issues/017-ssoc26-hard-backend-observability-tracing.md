# Add request tracing/log correlation for backend endpoints

Debugging multi-service flows (auth/content/progress/notifications) is hard without correlation IDs.

## Task
- Add a request correlation id middleware (or equivalent) in backend.
- Ensure correlation id is logged and returned in responses where appropriate.
- Propagate correlation id to any outbound calls.

## Acceptance criteria
- Logs include correlation id for relevant endpoints.
- Tests updated to validate header presence/propagation.

Labels: ssoc26, hard, enhancement

