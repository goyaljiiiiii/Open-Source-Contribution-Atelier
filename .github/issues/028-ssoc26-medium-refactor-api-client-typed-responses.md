# Refactor API client to return typed responses

Frontend API calls are hard to maintain because return shapes aren’t consistent.

## Task
- Review `frontend/src/lib/api.ts`.
- Improve typing for common response shapes.
- Standardize error handling return format.

## Acceptance criteria
- TypeScript compile passes.
- Reduced `any` usage in API layer.

Labels: ssoc26, medium, enhancement

