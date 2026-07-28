"""
Cron expression challenge lesson plugin.

Validates a submitted 5-field cron expression (minute hour day-of-month
month day-of-week) by actually computing next-run timestamps and
comparing against expected ones — not string-matching, which would
unfairly fail equivalent-but-differently-written expressions (e.g.
"0,15,30,45" vs "*/15" for the minute field describe the same schedule).

Scope: standard 5-field cron syntax with *, ranges (a-b), steps (*/N,
a-b/N), and comma lists. Does NOT support the @daily/@hourly/@reboot
shorthand extensions — explicitly out of scope for this exercise type.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Set

from .plugins import LessonPlugin, registry


class CronParseError(Exception):
    """Raised when a cron field can't be parsed."""


def _parse_field(field: str, min_value: int, max_value: int) -> Set[int]:
    """
    Parse a single cron field (minute/hour/day/month/weekday) into the
    set of matching integer values. Supports *, a-b ranges, */N and
    a-b/N steps, and comma-separated lists of any of the above.
    """
    if not field:
        raise CronParseError("empty field")

    result: Set[int] = set()

    for part in field.split(","):
        part = part.strip()
        if not part:
            raise CronParseError(f"empty component in field '{field}'")

        step = 1
        if "/" in part:
            base, step_str = part.split("/", 1)
            try:
                step = int(step_str)
            except ValueError:
                raise CronParseError(f"invalid step in '{part}'")
            if step <= 0:
                raise CronParseError(f"step must be positive in '{part}'")
        else:
            base = part

        if base == "*":
            range_start, range_end = min_value, max_value
        elif "-" in base:
            try:
                range_start, range_end = (int(x) for x in base.split("-", 1))
            except ValueError:
                raise CronParseError(f"invalid range in '{part}'")
        else:
            try:
                single = int(base)
            except ValueError:
                raise CronParseError(f"invalid value '{base}'")
            range_start, range_end = single, single
            if step != 1:
                raise CronParseError(f"step not valid on a single value: '{part}'")

        if range_start < min_value or range_end > max_value or range_start > range_end:
            raise CronParseError(
                f"'{part}' out of bounds for field range [{min_value}, {max_value}]"
            )

        result.update(range(range_start, range_end + 1, step))

    return result


class ParsedCron:
    """A parsed 5-field cron expression, able to compute next-run times."""

    def __init__(self, expression: str):
        fields = expression.strip().split()
        if len(fields) != 5:
            raise CronParseError(
                f"expected 5 fields (minute hour day month weekday), got {len(fields)}"
            )

        minute_f, hour_f, day_f, month_f, weekday_f = fields

        self.minutes = _parse_field(minute_f, 0, 59)
        self.hours = _parse_field(hour_f, 0, 23)
        self.days = _parse_field(day_f, 1, 31)
        self.months = _parse_field(month_f, 1, 12)
        self.weekdays = _parse_field(weekday_f, 0, 6)  # 0 = Sunday, cron convention

        self._day_field_is_wildcard = day_f.strip() == "*"
        self._weekday_field_is_wildcard = weekday_f.strip() == "*"

    def _matches(self, dt: datetime) -> bool:
        if dt.minute not in self.minutes:
            return False
        if dt.hour not in self.hours:
            return False
        if dt.month not in self.months:
            return False

        # Cron convention: if BOTH day-of-month and day-of-week are
        # restricted (non-wildcard), a match on EITHER is sufficient (OR
        # semantics) — a commonly-missed edge case in naive implementations.
        day_matches = dt.day in self.days
        weekday_matches = (dt.weekday() + 1) % 7 in self.weekdays  # Python Mon=0 -> cron Sun=0

        if self._day_field_is_wildcard and self._weekday_field_is_wildcard:
            return True
        if self._day_field_is_wildcard:
            return weekday_matches
        if self._weekday_field_is_wildcard:
            return day_matches
        return day_matches or weekday_matches

    def next_run_times(self, start: datetime, count: int, max_iterations: int = 200000) -> List[datetime]:
        """
        Compute the next `count` run times strictly after `start`,
        checking minute-by-minute (cron granularity is 1 minute).
        max_iterations bounds runtime for pathological expressions that
        might otherwise search very far into the future.
        """
        results: List[datetime] = []
        current = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
        iterations = 0

        while len(results) < count and iterations < max_iterations:
            if self._matches(current):
                results.append(current)
            current += timedelta(minutes=1)
            iterations += 1

        return results


class CronExpressionChallengePlugin(LessonPlugin):
    """
    Lesson plugin for cron expression writing challenges.

    Expected submission data shape:
    {
        "submitted_expression": "0 9 * * 1-5",
        "start_time": "2026-01-01T00:00:00",
        "expected_next_runs": [
            "2026-01-01T09:00:00",
            "2026-01-02T09:00:00"
        ]
    }
    """

    identifier = "cron_challenge"
    version = "1.0"
    name = "Cron Expression Challenge"
    description = (
        "Write a 5-field cron expression matching an expected run "
        "schedule — validated by computing actual next-run timestamps, "
        "not string comparison, so equivalent expressions written "
        "differently both pass."
    )

    @classmethod
    def validate_submission(cls, data: Dict[str, Any]) -> bool:
        if not isinstance(data.get("submitted_expression"), str) or not data["submitted_expression"].strip():
            return False
        if not isinstance(data.get("start_time"), str):
            return False
        expected = data.get("expected_next_runs")
        if not isinstance(expected, list) or not expected or not all(isinstance(t, str) for t in expected):
            return False

        try:
            datetime.fromisoformat(data["start_time"])
            for t in expected:
                datetime.fromisoformat(t)
        except ValueError:
            return False

        return True

    @classmethod
    def evaluate_progress(cls, user, data: Dict[str, Any]) -> float:
        if not cls.validate_submission(data):
            return 0.0

        try:
            parsed_cron = ParsedCron(data["submitted_expression"])
        except CronParseError:
            return 0.0

        start = datetime.fromisoformat(data["start_time"])
        expected_runs = [datetime.fromisoformat(t) for t in data["expected_next_runs"]]

        actual_runs = parsed_cron.next_run_times(start, len(expected_runs))

        if actual_runs == expected_runs:
            return 100.0

        # Partial credit: proportion of the expected runs correctly matched
        matches = sum(1 for a, e in zip(actual_runs, expected_runs) if a == e)
        return round((matches / len(expected_runs)) * 100.0, 2)


registry.register(CronExpressionChallengePlugin)
