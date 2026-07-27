import logging

logger = logging.getLogger(__name__)
from __future__ import annotations

from typing import Optional


def safe_parse_date(date_str: Optional[str]):
    if not date_str:
        return None
    try:
        # Accept YYYY-MM-DD
        from datetime import datetime

        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception as e:
        logger.warning("Caught exception: %s", e)
        return None
