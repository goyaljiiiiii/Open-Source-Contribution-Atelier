"""
Redact sensitive parameter values from SQL strings before logging or export.

Uses regex patterns to strip passwords, tokens, secrets, and API keys from
common SQL assignment and comparison forms.
"""

from __future__ import annotations

import re

# Column / parameter names that commonly hold secrets (case-insensitive).
_SENSITIVE_NAMES = (
    r"password",
    r"passwd",
    r"token",
    r"secret",
    r"api_key",
    r"apikey",
    r"access_key",
    r"private_key",
    r"auth",
    r"credential",
)

_NAME_PATTERN = "|".join(_SENSITIVE_NAMES)

# Matches: password = 'value', "token"='value', api_key => 'value', etc.
_ASSIGNMENT_RE = re.compile(
    rf'(["\']?(?:{_NAME_PATTERN})["\']?\s*(?:=|:=|=>)\s*)'
    rf"(['\"])(?:\\.|(?!\2).)*\2",
    re.IGNORECASE,
)

# Matches: WHERE password LIKE 'value'
_LIKE_RE = re.compile(
    rf'(["\']?(?:{_NAME_PATTERN})["\']?\s+LIKE\s+)'
    rf"(['\"])(?:\\.|(?!\2).)*\2",
    re.IGNORECASE,
)

# Matches: IN ('secret1', 'secret2') when column name appears earlier in clause.
_IN_LIST_RE = re.compile(
    rf'(["\']?(?:{_NAME_PATTERN})["\']?\s+IN\s*\()'
    rf"([^)]*)\)",
    re.IGNORECASE,
)

_REDACTED = "[REDACTED]"


def _redact_in_list(match: re.Match[str]) -> str:
    prefix = match.group(1)
    return f"{prefix}{_REDACTED})"


def sanitize_sql(sql: str) -> str:
    """
    Return *sql* with sensitive literal values replaced by ``[REDACTED]``.

    Handles common ``=``, ``LIKE``, and ``IN (...)`` forms for known secret
    column/parameter names.
    """
    if not sql:
        return sql

    sanitized = _ASSIGNMENT_RE.sub(rf"\1'{_REDACTED}'", sql)
    sanitized = _LIKE_RE.sub(rf"\1'{_REDACTED}'", sanitized)
    sanitized = _IN_LIST_RE.sub(_redact_in_list, sanitized)
    return sanitized
