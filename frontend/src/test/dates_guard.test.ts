import { describe, it, expect } from "vitest";
import { formatTimeAgo, formatInTimeZone } from "../lib/dates";

describe("dates.ts invalid date validation guards", () => {
  describe("formatTimeAgo", () => {
    it("returns 'N/A' for an invalid date string", () => {
      expect(formatTimeAgo("invalid-date-string")).toBe("N/A");
    });

    it("returns 'N/A' for an empty string", () => {
      expect(formatTimeAgo("")).toBe("N/A");
    });

    it("returns 'N/A' for NaN input", () => {
      expect(formatTimeAgo(NaN)).toBe("N/A");
    });

    it("returns a valid relative time string for a valid Date", () => {
      const result = formatTimeAgo(new Date());
      expect(result).toContain("ago");
    });

    it("returns a valid relative time string for a valid ISO string", () => {
      const result = formatTimeAgo("2024-01-01T00:00:00Z");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("N/A");
    });

    it("returns a valid relative time string for a valid timestamp number", () => {
      const result = formatTimeAgo(Date.now() - 60000);
      expect(result).toContain("ago");
    });
  });

  describe("formatInTimeZone", () => {
    it("returns 'N/A' for an invalid date string", () => {
      expect(formatInTimeZone("not-a-date", "UTC")).toBe("N/A");
    });

    it("returns 'N/A' for an empty string", () => {
      expect(formatInTimeZone("", "UTC")).toBe("N/A");
    });

    it("returns 'N/A' for NaN input", () => {
      expect(formatInTimeZone(NaN, "America/New_York")).toBe("N/A");
    });

    it("returns a formatted string for a valid Date", () => {
      const result = formatInTimeZone(new Date("2024-06-15T12:00:00Z"), "UTC");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("N/A");
    });

    it("returns a formatted string for a valid ISO string", () => {
      const result = formatInTimeZone("2024-06-15T12:00:00Z", "UTC");
      expect(typeof result).toBe("string");
      expect(result).not.toBe("N/A");
    });
  });
});
