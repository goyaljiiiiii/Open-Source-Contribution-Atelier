import { describe, it, expect } from "vitest";
import { getSentryRelease, initSentrySafely } from "../utils/sentryHelper";

describe("sentryHelper", () => {
  it("should return development default when no environment commit SHA is set", () => {
    const release = getSentryRelease({});
    expect(typeof release).toBe("string");
  });

  it("should return commit SHA from env parameter if available", () => {
    const release = getSentryRelease({ VITE_VERCEL_GIT_COMMIT_SHA: "abc1234" });
    expect(release).toBe("abc1234");
  });

  it("should handle undefined dsn without error in initSentrySafely", async () => {
    await expect(initSentrySafely(undefined)).resolves.not.toThrow();
  });
});
