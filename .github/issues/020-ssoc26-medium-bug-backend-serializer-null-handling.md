# Fix serializer null/optional handling in accounts/progress

Some API responses may omit optional fields, leading to frontend crashes or serializer errors.

## Task
- Identify failing serializers/fields in `accounts` and `progress`.
- Make serializer handling robust for missing/nullable fields.
- Add tests to reproduce and validate behavior.

## Acceptance criteria
- Endpoints don’t error when optional fields are missing.
- Tests updated/added.

Labels: ssoc26, medium, bug

