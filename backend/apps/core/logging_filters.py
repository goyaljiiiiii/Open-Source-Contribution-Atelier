import logging
import re

from apps.core.middleware.request_id import get_request_id, get_user_id


class RequestIdFilter(logging.Filter):
    """
    Logging filter that injects the current request_id and user_id into log records.
    """

    def filter(self, record):
        record.request_id = get_request_id() or "-"
        record.user_id = get_user_id() or "-"
        return True


class SensitiveDataFilter(logging.Filter):
    """
    Logging filter that scrubs passwords, Bearer tokens, and secrets from log messages.
    """

    SENSITIVE_PATTERNS = [
        (re.compile(r'(password|secret|token|api_key|access_token)=["\']?[^\s"\'&]+["\']?', re.IGNORECASE), r'\1=[REDACTED]'),
        (re.compile(r'Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*', re.IGNORECASE), r'Bearer [REDACTED]'),
    ]

    def filter(self, record):
        if isinstance(record.msg, str):
            for pattern, replacement in self.SENSITIVE_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)
        return True

