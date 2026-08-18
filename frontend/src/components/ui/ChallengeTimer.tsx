import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface ChallengeTimerProps {
  initialSeconds?: number;
  onExpire?: () => void;
}

export function ChallengeTimer({
  initialSeconds = 300,
  onExpire,
}: ChallengeTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep latest onExpire reference without triggering effect
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Reset if initialSeconds changes
  useEffect(() => {
    setTimeLeft(initialSeconds);
    hasExpiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-black bg-amber-100 text-amber-900 font-mono text-xs font-bold dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800"
    >
      <Clock size={14} className="animate-pulse" />
      <span>{timeLeft > 0 ? formatted : "Time expired!"}</span>
    </div>
  );
}

export default ChallengeTimer;
