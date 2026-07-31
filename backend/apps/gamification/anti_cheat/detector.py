"""
Anti-cheat heuristics for quiz completions and suspicious activity patterns.

Detects rapid quiz completions, IP request-rate anomalies, and simple keystroke
timing irregularities. Optionally persists ``AntiCheatFlag`` records.
"""

from __future__ import annotations

import logging
import statistics
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Minimum average seconds per question before flagging rapid completion.
MIN_SECONDS_PER_QUESTION = 3.0

# Requests per minute from a single IP that triggers rate anomaly flag.
IP_REQUESTS_PER_MINUTE_THRESHOLD = 120

# Keystroke intervals (ms) below this suggest bot-like input.
MIN_KEYSTROKE_INTERVAL_MS = 20


@dataclass
class AntiCheatResult:
    """Outcome of an anti-cheat evaluation."""

    risk_score: float
    flags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    flag_ids: list[int] = field(default_factory=list)

    @property
    def is_suspicious(self) -> bool:
        return self.risk_score >= 0.5 or bool(self.flags)


class _IPRateTracker:
    """In-memory sliding-window IP request counter (dev / single-process)."""

    def __init__(self, window_seconds: int = 60) -> None:
        self._window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def record(self, ip: str) -> int:
        now = time.monotonic()
        events = self._events[ip]
        cutoff = now - self._window
        while events and events[0] < cutoff:
            events.popleft()
        events.append(now)
        return len(events)


_ip_tracker = _IPRateTracker()


class AntiCheatDetector:
    """
    Evaluate quiz and session data for cheating indicators.

    Parameters
    ----------
    user:
        Django user instance (optional for anonymous checks).
    persist_flags:
        When True, create ``AntiCheatFlag`` model rows for flagged events.
    """

    def __init__(self, user=None, persist_flags: bool = True) -> None:
        self.user = user
        self.persist_flags = persist_flags

    def evaluate_quiz_completion(
        self,
        *,
        question_count: int,
        duration_seconds: float,
        keystroke_intervals_ms: list[float] | None = None,
        client_ip: str | None = None,
        extra_metadata: dict[str, Any] | None = None,
    ) -> AntiCheatResult:
        """Run all anti-cheat checks for a quiz completion event."""
        flags: list[str] = []
        metadata: dict[str, Any] = dict(extra_metadata or {})
        risk_score = 0.0

        if question_count > 0 and duration_seconds >= 0:
            avg_per_question = duration_seconds / question_count
            metadata["avg_seconds_per_question"] = round(avg_per_question, 3)
            if avg_per_question < MIN_SECONDS_PER_QUESTION:
                flags.append("rapid_quiz_completion")
                risk_score += 0.5

        if client_ip:
            count = _ip_tracker.record(client_ip)
            metadata["ip_requests_last_minute"] = count
            if count > IP_REQUESTS_PER_MINUTE_THRESHOLD:
                flags.append("ip_rate_anomaly")
                risk_score += 0.35

        if keystroke_intervals_ms:
            ks_result = self._check_keystroke_dynamics(keystroke_intervals_ms)
            metadata.update(ks_result)
            if ks_result.get("keystroke_suspicious"):
                flags.append("keystroke_anomaly")
                risk_score += 0.25

        risk_score = min(risk_score, 1.0)
        result = AntiCheatResult(
            risk_score=round(risk_score, 3),
            flags=flags,
            metadata=metadata,
        )

        if result.is_suspicious and self.persist_flags and self.user is not None:
            result.flag_ids = self._persist_flags(result)

        return result

    def check_ip_rate(self, client_ip: str) -> AntiCheatResult:
        """Standalone IP rate anomaly check."""
        count = _ip_tracker.record(client_ip)
        flags: list[str] = []
        risk_score = 0.0
        if count > IP_REQUESTS_PER_MINUTE_THRESHOLD:
            flags.append("ip_rate_anomaly")
            risk_score = 0.35

        result = AntiCheatResult(
            risk_score=risk_score,
            flags=flags,
            metadata={"ip_requests_last_minute": count},
        )
        if result.is_suspicious and self.persist_flags and self.user is not None:
            result.flag_ids = self._persist_flags(result)
        return result

    @staticmethod
    def _check_keystroke_dynamics(intervals_ms: list[float]) -> dict[str, Any]:
        """Simple keystroke timing analysis."""
        if len(intervals_ms) < 3:
            return {"keystroke_sample_size": len(intervals_ms)}

        mean_interval = statistics.mean(intervals_ms)
        stdev = statistics.pstdev(intervals_ms) if len(intervals_ms) > 1 else 0.0
        too_fast = sum(1 for i in intervals_ms if i < MIN_KEYSTROKE_INTERVAL_MS)
        suspicious = too_fast > len(intervals_ms) * 0.5 or stdev < 5.0

        return {
            "keystroke_sample_size": len(intervals_ms),
            "keystroke_mean_ms": round(mean_interval, 2),
            "keystroke_stdev_ms": round(stdev, 2),
            "keystroke_too_fast_count": too_fast,
            "keystroke_suspicious": suspicious,
        }

    def _persist_flags(self, result: AntiCheatResult) -> list[int]:
        """Create AntiCheatFlag rows when the model is available."""
        try:
            from apps.gamification.models import AntiCheatFlag
        except ImportError:
            return []

        ids: list[int] = []
        for reason in result.flags:
            flag = AntiCheatFlag.objects.create(
                user=self.user,
                reason=reason,
                risk_score=result.risk_score,
                metadata=result.metadata,
            )
            ids.append(flag.pk)
            logger.info(
                "Anti-cheat flag created user=%s reason=%s score=%s",
                getattr(self.user, "pk", None),
                reason,
                result.risk_score,
            )
        return ids
