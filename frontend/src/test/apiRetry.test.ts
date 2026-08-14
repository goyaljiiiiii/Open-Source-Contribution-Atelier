import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseRetryAfterHeader,
  calculateBackoffDelay,
  isIdempotentMethod,
  fetchApi,
} from "../lib/api";
import { ApiError } from "../lib/apiErrors";

describe("API Automatic Retry Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseRetryAfterHeader", () => {
    it("returns null for null or empty strings", () => {
      expect(parseRetryAfterHeader(null)).toBeNull();
      expect(parseRetryAfterHeader("")).toBeNull();
    });

    it("parses integer seconds into milliseconds", () => {
      expect(parseRetryAfterHeader("5")).toBe(5000);
      expect(parseRetryAfterHeader("120")).toBe(120000);
    });

    it("parses HTTP date strings into milliseconds from now", () => {
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const delay = parseRetryAfterHeader(futureDate);
      expect(delay).not.toBeNull();
      expect(delay!).toBeGreaterThan(0);
      expect(delay!).toBeLessThanOrEqual(10000);
    });
  });

  describe("calculateBackoffDelay", () => {
    it("honors retryAfterMs when present", () => {
      const delay = calculateBackoffDelay(1, 500, 10000, 3000);
      expect(delay).toBe(3000);
    });

    it("computes exponential delay within jitter bounds", () => {
      // Attempt 1: baseDelay 500ms, cap 500ms
      const delay1 = calculateBackoffDelay(1, 500, 10000, null);
      expect(delay1).toBeGreaterThanOrEqual(0);
      expect(delay1).toBeLessThanOrEqual(500);

      // Attempt 3: baseDelay 500 * 2^2 = 2000ms
      const delay3 = calculateBackoffDelay(3, 500, 10000, null);
      expect(delay3).toBeGreaterThanOrEqual(0);
      expect(delay3).toBeLessThanOrEqual(2000);
    });

    it("respects maxDelayMs cap", () => {
      const delay = calculateBackoffDelay(10, 500, 4000, null);
      expect(delay).toBeLessThanOrEqual(4000);
    });
  });

  describe("isIdempotentMethod", () => {
    it("identifies GET, HEAD, OPTIONS as idempotent", () => {
      expect(isIdempotentMethod("GET")).toBe(true);
      expect(isIdempotentMethod("get")).toBe(true);
      expect(isIdempotentMethod("HEAD")).toBe(true);
      expect(isIdempotentMethod("OPTIONS")).toBe(true);
      expect(isIdempotentMethod(undefined)).toBe(true);
    });

    it("identifies POST, PUT, PATCH, DELETE as mutating", () => {
      expect(isIdempotentMethod("POST")).toBe(false);
      expect(isIdempotentMethod("PUT")).toBe(false);
      expect(isIdempotentMethod("PATCH")).toBe(false);
      expect(isIdempotentMethod("DELETE")).toBe(false);
    });
  });

  describe("fetchApi retry behavior", () => {
    it("retries idempotent GET request on 503 until success", async () => {
      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        if (calls < 3) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Service Unavailable" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      const res = await fetchApi("/test-503", {
        method: "GET",
        requireAuth: false,
        baseDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(calls).toBe(3);
      expect(res).toEqual({ success: true });
    });

    it("honors Retry-After header on 429 rate limit errors", async () => {
      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Too Many Requests" }), {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "1",
              },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ data: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      const res = await fetchApi("/test-429", {
        method: "GET",
        requireAuth: false,
        baseDelayMs: 10,
      });

      expect(calls).toBe(2);
      expect(res).toEqual({ data: "ok" });
    });

    it("does NOT retry 4xx errors like 400 Bad Request or 404 Not Found", async () => {
      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        return Promise.resolve(
          new Response(JSON.stringify({ detail: "Not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      await expect(
        fetchApi("/test-404", {
          method: "GET",
          requireAuth: false,
          maxRetries: 3,
        }),
      ).rejects.toThrow();

      expect(calls).toBe(1);
    });

    it("does NOT retry POST mutations by default", async () => {
      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Internal Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      await expect(
        fetchApi("/test-post", {
          method: "POST",
          body: JSON.stringify({ item: 1 }),
          requireAuth: false,
        }),
      ).rejects.toThrow();

      expect(calls).toBe(1);
    });

    it("retries POST mutations if retryMutations: true is explicitly enabled", async () => {
      let calls = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Bad Gateway" }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ id: 123 }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }),
        );
      });

      const res = await fetchApi("/test-post-retry", {
        method: "POST",
        body: JSON.stringify({ item: 1 }),
        retryMutations: true,
        requireAuth: false,
        baseDelayMs: 10,
      });

      expect(calls).toBe(2);
      expect(res).toEqual({ id: 123 });
    });
  });
});
