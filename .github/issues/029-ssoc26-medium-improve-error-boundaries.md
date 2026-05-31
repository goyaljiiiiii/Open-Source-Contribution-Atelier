# Add error boundaries around main routes

Unexpected runtime errors can break the whole app without a recovery UI.

## Task
- Add React error boundary component.
- Wrap major route sections so the app shows a friendly fallback.
- Optionally add a retry action.

## Acceptance criteria
- App does not fully crash on render errors.
- Fallback UI displayed and logs error.

Labels: ssoc26, medium, accessibility

