import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PRReviewGamePage } from "../pages/PRReviewGamePage";
import { ThemeProvider } from "../context/ThemeContext";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("PRReviewGamePage unsaved draft warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("registers beforeunload warning when draft text is typed", () => {
    renderWithTheme(<PRReviewGamePage />);

    const textarea = screen.getByPlaceholderText(/Write inline rationale/i);
    fireEvent.change(textarea, { target: { value: "Potential off-by-one error found" } });

    expect(screen.getByText("Unsaved Draft")).toBeDefined();

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("shows discard confirmation dialog when resetting with unsaved draft", () => {
    renderWithTheme(<PRReviewGamePage />);

    const textarea = screen.getByPlaceholderText(/Write inline rationale/i);
    fireEvent.change(textarea, { target: { value: "My draft review comment" } });

    const resetBtn = screen.getByRole("button", { name: /Reset Challenge/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText("Discard Unsaved Review Draft?")).toBeDefined();
    expect(
      screen.getByText(/Resetting the challenge will discard your unsaved work/i),
    ).toBeDefined();

    // Click "Keep Editing"
    const cancelBtn = screen.getByRole("button", { name: /Keep Editing/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText("Discard Unsaved Review Draft?")).toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe("My draft review comment");
  });

  it("clears draft and removes beforeunload warning after submitting review action", () => {
    renderWithTheme(<PRReviewGamePage />);

    const textarea = screen.getByPlaceholderText(/Write inline rationale/i);
    fireEvent.change(textarea, { target: { value: "Bug found here!" } });

    // Submit "Request Changes"
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    fireEvent.click(requestChangesBtn);

    // Draft is cleared on next level
    expect(screen.queryByText("Unsaved Draft")).toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe("");

    // beforeunload should not be prevented
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
