import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { CustomTooltip } from "../components/ui/OnboardingTour";
import { TooltipRenderProps } from "react-joyride";

describe("OnboardingTour CustomTooltip focus trap and keyboard accessibility", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const createProps = (overrides: Partial<TooltipRenderProps> = {}): TooltipRenderProps => {
    return {
      index: 0,
      size: 3,
      isLastStep: false,
      step: {
        target: "#step-1",
        title: "Welcome Tour Step",
        content: "This is a guided step content.",
      },
      backProps: {
        "aria-label": "Previous step",
        "data-action": "back",
        onClick: vi.fn(),
        role: "button",
        title: "Previous step",
      },
      closeProps: {
        "aria-label": "Skip Tour",
        "data-action": "close",
        onClick: vi.fn(),
        role: "button",
        title: "Skip Tour",
      },
      primaryProps: {
        "aria-label": "Next",
        "data-action": "primary",
        onClick: vi.fn(),
        role: "button",
        title: "Next",
      },
      tooltipProps: {
        "aria-modal": true,
      },
      continuous: true,
      setTooltipRef: vi.fn(),
      ...overrides,
    };
  };

  it("renders with dialog role, modal attribute, and proper accessible label", () => {
    const props = createProps();
    render(<CustomTooltip {...props} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Welcome Tour Step");
  });

  it("auto-focuses primary action button on step mount/navigation", async () => {
    const props = createProps({ index: 1 });
    render(<CustomTooltip {...props} />);

    await waitFor(() => {
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(document.activeElement).toBe(nextButton);
    });
  });

  it("traps focus between first and last interactive element on Tab / Shift+Tab", async () => {
    const props = createProps({ index: 1 }); // Step 2 has Back, Next, Close
    render(<CustomTooltip {...props} />);

    const skipButton = screen.getByRole("button", { name: /skip tour/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    // Focus last element (nextButton) and press Tab -> should wrap to first (skipButton)
    nextButton.focus();
    expect(document.activeElement).toBe(nextButton);

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(skipButton);

    // Focus first element (skipButton) and press Shift+Tab -> should wrap to last (nextButton)
    skipButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(nextButton);
  });

  it("triggers close action on Escape keypress", () => {
    const mockClose = vi.fn();
    const props = createProps({
      closeProps: {
        "aria-label": "Skip Tour",
        "data-action": "close",
        onClick: mockClose,
        role: "button",
        title: "Skip Tour",
      },
    });

    render(<CustomTooltip {...props} />);
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
