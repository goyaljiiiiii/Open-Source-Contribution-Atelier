# Migration Lock Risk Audit

This document audits the last ~20 migrations for dangerous patterns that acquire `ACCESS EXCLUSIVE` locks on high-traffic tables during production deploys.

| Migration | Table | Risk | Reason |
|-----------|-------|------|--------|
| `progress.0008_xpmultiplierevent...` | `LessonProgress` | **HIGH** | `AddField` with `default=0` and `default=1.0` rewrites the table. |
| `progress.0018_plagiarismreport...` | `LessonProgress` | **HIGH** | `AlterField` on `attempt_count` (adding `default=0`). |
| `notifications.0003_alter_notification...` | `Notification` | **HIGH** | `AlterField` on `notif_type` (changing choices). |
| `notifications.0006_notificationpreference...` | `Notification` | **HIGH** | `AlterField` on `notif_type` (changing choices). |
| `progress.0003_exerciseattempt...` | `LessonProgress` | **LOW** | `AddField` with `null=True`. Short lock. |
| `progress.0022_dailyactivity` | `DailyActivity` | **LOW** | `CreateModel` (table is new, so it is empty). |

## Recommendations
1. `progress.0008` should be split into 3 phases (Schema, Data, Constraint) since adding a non-null field with a default to an existing large table causes a heavy rewrite lock.
2. `notifications.0003` and `0006` alter CharField choices. These changes are checked at the application level in Django and should be wrapped in `SeparateDatabaseAndState` to prevent unnecessary schema locks on PostgreSQL.
