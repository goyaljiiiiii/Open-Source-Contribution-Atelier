# Persist theme (dark/light) across sessions

Theme preference resets on refresh for some users.

## Task
- Inspect `frontend/src/hooks/useTheme.ts`.
- Persist theme selection (localStorage or existing user profile endpoint if available).
- Ensure UI updates without flashes.

## Acceptance criteria
- Theme persists after reload.
- No console errors.

Labels: ssoc26, medium, enhancement

