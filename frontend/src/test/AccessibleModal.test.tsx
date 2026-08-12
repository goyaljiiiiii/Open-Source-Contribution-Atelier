import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import React, { useState } from "react";
import { AccessibleModal } from "../components/ui/AccessibleModal";

describe("AccessibleModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders with role='dialog', aria-modal='true', and linked ARIA title/description", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={vi.fn()}
        title="Confirm Deletion"
        description="Are you sure you want to delete this resource?"
      >
        <button type="button">Confirm</button>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const titleEl = screen.getByText("Confirm Deletion");
    const descEl = screen.getByText(
      "Are you sure you want to delete this resource?",
    );

    expect(titleEl.id).toBeTruthy();
    expect(descEl.id).toBeTruthy();
    expect(dialog.getAttribute("aria-labelledby")).toBe(titleEl.id);
    expect(dialog.getAttribute("aria-describedby")).toBe(descEl.id);
  });

  it("restores focus to the trigger element when closed", async () => {
    const TestComponent = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button
            type="button"
            data-testid="trigger-btn"
            onClick={() => setIsOpen(true)}
          >
            Open Modal
          </button>
          <AccessibleModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Accessible Title"
          >
            <button
              type="button"
              data-testid="modal-close-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </AccessibleModal>
        </div>
      );
    };

    render(<TestComponent />);

    const triggerBtn = screen.getByTestId("trigger-btn");
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    // Open modal
    fireEvent.click(triggerBtn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByTestId("modal-close-btn");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Focus restored back to trigger element
    expect(document.activeElement).toBe(triggerBtn);
  });

  it("closes modal on Escape key press", () => {
    const handleClose = vi.fn();
    render(
      <AccessibleModal isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Modal Content</p>
      </AccessibleModal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes modal on backdrop click when closeOnOverlayClick is true", () => {
    const handleClose = vi.fn();
    render(
      <AccessibleModal
        isOpen={true}
        onClose={handleClose}
        title="Backdrop Test"
      >
        <p>Modal Content</p>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });
});
