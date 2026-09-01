import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { OfflineBanner } from "../components/OfflineBanner";
import React from "react";

afterEach(cleanup);

describe("OfflineBanner PWA Connectivity Indicator (Issue #2718)", () => {
  it("does not render when online initially", () => {
    render(<OfflineBanner />);

    expect(
      screen.queryByText(/You are offline/i),
    ).not.toBeInTheDocument();
  });

  it("displays sticky top banner when network drops offline", () => {
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(
      screen.getByText(/⚡ You are offline. Changes will sync automatically when back online./i),
    ).toBeInTheDocument();
  });

  it("displays Reconnected confirmation when connection recovers and auto-hides", () => {
    vi.useFakeTimers();
    render(<OfflineBanner />);

    // Go offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

    // Reconnect online
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByText(/🟢 Reconnected/i)).toBeInTheDocument();

    // Fast-forward 3 seconds timer
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/Reconnected/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
