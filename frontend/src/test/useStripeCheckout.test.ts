import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStripeCheckout } from "../hooks/useStripeCheckout";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

describe("useStripeCheckout hook", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle checkout_url response signature", async () => {
    vi.spyOn(api, "fetchApi").mockResolvedValueOnce({ checkout_url: "https://stripe.com/checkout123" });
    const { result } = renderHook(() => useStripeCheckout());

    await act(async () => {
      await result.current.subscribe(1);
    });

    expect(api.fetchApi).toHaveBeenCalledWith("/billing/checkout/", {
      method: "POST",
      body: JSON.stringify({ plan_id: 1 }),
    });
  });

  it("should handle url response signature", async () => {
    vi.spyOn(api, "fetchApi").mockResolvedValueOnce({ url: "https://stripe.com/session456" });
    const { result } = renderHook(() => useStripeCheckout());

    await act(async () => {
      await result.current.subscribe(2);
    });

    expect(api.fetchApi).toHaveBeenCalledWith("/billing/checkout/", {
      method: "POST",
      body: JSON.stringify({ plan_id: 2 }),
    });
  });
});
