import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ConnectionStatusIndicator } from "../components/ui/ConnectionStatusIndicator";

describe("ConnectionStatusIndicator keyboard accessibility", () => {
  afterEach(() => {
    cleanup();
  });
  const mockMetrics = {
    state: "OPEN",
    uptime: 120,
    reconnectionCount: 0,
    messagesSent: 15,
    messagesReceived: 20,
    lastError: null,
  };

  it("renders with correct tabIndex and role for keyboard accessibility", () => {
    render(<ConnectionStatusIndicator state="OPEN" getMetrics={() => mockMetrics} />);

    const button = screen.getByRole("button", { name: /connection status: connected/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("tabindex", "0");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows tooltip on keyboard focus and hides on blur", async () => {
    render(<ConnectionStatusIndicator state="OPEN" getMetrics={() => mockMetrics} />);

    const button = screen.getByRole("button", { name: /connection status: connected/i });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      button.focus();
    });

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("WS Connection Metrics")).toBeInTheDocument();
    expect(screen.getByText("120s")).toBeInTheDocument();

    act(() => {
      button.blur();
    });

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("toggles tooltip on Enter and Space keypress", () => {
    render(<ConnectionStatusIndicator state="OPEN" getMetrics={() => mockMetrics} />);

    const button = screen.getByRole("button", { name: /connection status: connected/i });

    // Press Enter to open
    fireEvent.keyDown(button, { key: "Enter" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Press Enter to close
    fireEvent.keyDown(button, { key: "Enter" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Press Space to open
    fireEvent.keyDown(button, { key: " " });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes tooltip on Escape keypress", () => {
    render(<ConnectionStatusIndicator state="OPEN" getMetrics={() => mockMetrics} />);

    const button = screen.getByRole("button", { name: /connection status: connected/i });

    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(button, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on mouse hover and hides on mouse leave", () => {
    render(<ConnectionStatusIndicator state="OPEN" getMetrics={() => mockMetrics} />);

    const button = screen.getByRole("button", { name: /connection status: connected/i });

    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
