import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  calculateBackoffDelay,
  DEFAULT_RETRY_POLICY,
  getRetryState,
  resetBackoff,
  clearRetryState,
} from "../../src/lib/offlineQueue";
import {
  calculateQuizRetryDelay,
  QUIZ_RETRY_POLICY,
} from "../../src/services/offlineSync";

describe("offline sync exponential backoff", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetBackoff();
    vi.useRealTimers();
  });

  it("starts at the configured base delay", () => {
    expect(calculateBackoffDelay(0, 0.5)).toBe(
      DEFAULT_RETRY_POLICY.baseDelayMs,
    );
  });

  it("doubles the exponential component for each failed attempt", () => {
    expect(calculateBackoffDelay(0, 0.5)).toBe(1000);
    expect(calculateBackoffDelay(1, 0.5)).toBe(2000);
    expect(calculateBackoffDelay(2, 0.5)).toBe(4000);
    expect(calculateBackoffDelay(3, 0.5)).toBe(8000);
  });

  it("caps the exponential delay", () => {
    expect(calculateBackoffDelay(99, 0.5)).toBe(
      DEFAULT_RETRY_POLICY.maxDelayMs,
    );
  });

  it("adds bounded positive and negative jitter", () => {
    const base = calculateBackoffDelay(2, 0.5);
    const low = calculateBackoffDelay(2, 0);
    const high = calculateBackoffDelay(2, 1);

    expect(base).toBe(4000);
    expect(low).toBe(3000);
    expect(high).toBe(5000);
  });

  it("never returns a negative delay", () => {
    expect(calculateBackoffDelay(0, 0)).toBeGreaterThanOrEqual(0);
  });

  it("clamps random values outside the expected range", () => {
    expect(calculateBackoffDelay(1, -10)).toBe(
      calculateBackoffDelay(1, 0),
    );
    expect(calculateBackoffDelay(1, 10)).toBe(
      calculateBackoffDelay(1, 1),
    );
  });

  it("uses the same backoff model for quiz retries", () => {
    expect(calculateQuizRetryDelay(0, 0.5)).toBe(
      QUIZ_RETRY_POLICY.baseDelayMs,
    );
    expect(calculateQuizRetryDelay(3, 0.5)).toBe(
      QUIZ_RETRY_POLICY.baseDelayMs * 8,
    );
  });

  it("keeps quiz retry delays within the configured ceiling", () => {
    expect(calculateQuizRetryDelay(100, 1)).toBe(
      QUIZ_RETRY_POLICY.maxDelayMs,
    );
  });

  it("stores and clears retry state for queued actions", () => {
    const state = {
      attempts: 3,
      nextRetryAt: Date.now() + 1000,
      lastAttemptAt: Date.now(),
      lastStatus: 503,
      lastError: null,
    };

    localStorage.setItem(
      "atelier_sync_retry_state",
      JSON.stringify({ "progress-demo": state }),
    );

    expect(getRetryState("progress-demo")).toEqual(state);

    clearRetryState("progress-demo");

    expect(getRetryState("progress-demo")).toBeNull();
  });

  it("does not use a fixed five-second retry constant", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/lib/offlineQueue.ts", "utf8"),
    );

    expect(source).not.toContain("setTimeout(() => syncOfflineQueue(), 5000)");
    expect(source).toContain("calculateBackoffDelay");
    expect(source).toContain("jitterRatio");
  });
});
