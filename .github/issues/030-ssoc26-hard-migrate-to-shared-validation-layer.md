# Introduce shared validation layer for backend inputs

Currently validation is spread across serializers/views, which makes it inconsistent.

## Task
- Identify repeated validation patterns (e.g., challenge/progress update endpoints).
- Create a shared validator/helper layer.
- Update serializers/views to use it.

## Acceptance criteria
- Validation behavior remains consistent.
- Tests updated or added.

Labels: ssoc26, hard, enhancement

