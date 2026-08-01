import { describe, expect, it } from "vitest";
import { ApiError, createApiError, getApiErrorMessage } from "../lib/apiErrors";

describe("apiErrors", () => {
  it("maps common statuses to user-friendly messages", () => {
    expect(createApiError({ status: 401 }).message).toContain("session has expired");
    expect(createApiError({ status: 403 }).message).toContain("permission");
    expect(createApiError({ status: 404 }).message).toContain("couldn't find");
    expect(createApiError({ status: 500 }).message).toContain("server");
  });

  it("preserves ApiError messages for display helpers", () => {
    const error = new ApiError("Custom message", { status: 503, retryable: true });
    expect(getApiErrorMessage(error)).toBe("Custom message");
  });
});