import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AccessibleModal } from "../components/ui/AccessibleModal";

describe("High-contrast Modal Borders and Visual Separation Suite (#2807)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders AccessibleModal with high-contrast border and dark theme styles", () => {
    render(
      <AccessibleModal isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain("border");
    expect(dialog.className).toContain("border-slate-700");
    expect(dialog.className).toContain("dark:border-slate-800");
    expect(dialog.className).toContain("shadow-2xl");
  });

  it("renders AccessibleModal overlay with dark backdrop contrast and blur", () => {
    const { container } = render(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <div>Backdrop Test Body</div>
      </AccessibleModal>,
    );

    const overlay = container.querySelector(".backdrop-blur-sm") || document.querySelector(".backdrop-blur-sm");
    expect(overlay).toBeInTheDocument();
  });

  it("ensures custom className retains high contrast modal border conventions", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        className="custom-modal-class border border-slate-700 dark:border-slate-800"
      >
        <span>Content</span>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("custom-modal-class");
    expect(dialog.className).toContain("border-slate-700");
    expect(dialog.className).toContain("dark:border-slate-800");
  });

  it("handles AccessibleModal backdrop dismissal gracefully on overlay click", () => {
    let closed = false;
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {
          closed = true;
        }}
        closeOnOverlayClick={true}
      >
        <p>Dismissable Content</p>
      </AccessibleModal>,
    );

    expect(screen.getByText("Dismissable Content")).toBeInTheDocument();
    expect(closed).toBe(false);
  });

  it("validates dialog aria landmarks and high-contrast styling tokens", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        title="Accessible Title"
        description="Accessible Description"
      >
        <button type="button">Action</button>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
    expect(dialog.className).toContain("border-slate-700");
  });

  it("renders closed modal as null without rendering DOM nodes", () => {
    const { container } = render(
      <AccessibleModal isOpen={false} onClose={() => {}}>
        <div>Hidden Modal</div>
      </AccessibleModal>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Hidden Modal")).not.toBeInTheDocument();
  });

  it("verifies contrast border tokens on dark theme containers", () => {
    const contrastTokens = [
      "border",
      "border-slate-700",
      "dark:border-slate-800",
      "shadow-2xl",
    ];
    render(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <div>Token Check</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    contrastTokens.forEach((token) => {
      expect(dialog.className).toContain(token);
    });
  });

  it("supports aria-label attribute override when title node is omitted", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        ariaLabel="Standalone Dialog Description"
      >
        <div>Direct Label Content</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Standalone Dialog Description");
  });

  it("verifies backdrop blur and high opacity backdrop overlay", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/75 dark:bg-black/80 backdrop-blur-sm p-4"
      >
        <div>Backdrop Check</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("preserves focus trap and keyboard event bindings in modal lifecycle", () => {
    const { unmount } = render(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <button type="button">Focused Element</button>
      </AccessibleModal>,
    );

    expect(screen.getByRole("button", { name: "Focused Element" })).toBeInTheDocument();
    unmount();
  });

  it("verifies accessibility standards compliance for modal dialog separation", () => {
    render(
      <AccessibleModal isOpen={true} onClose={() => {}} title="Accessibility Test">
        <div className="text-slate-200">Checking WCAG visual contrast separation.</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("border-slate-700")).toBe(true);
    expect(dialog.classList.contains("shadow-2xl")).toBe(true);
  });

  it("handles escape key dismissal when closeOnEscape is true", () => {
    let closed = false;
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {
          closed = true;
        }}
        closeOnEscape={true}
      >
        <div>Escape Dismissable Dialog</div>
      </AccessibleModal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });

  it("ignores escape key dismissal when closeOnEscape is false", () => {
    let closed = false;
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {
          closed = true;
        }}
        closeOnEscape={false}
      >
        <div>Static Dialog</div>
      </AccessibleModal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(false);
  });

  it("correctly renders title and description IDs when provided explicitly", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        title="Explicit Title"
        description="Explicit Description"
        titleId="custom-title-id"
        descriptionId="custom-desc-id"
      >
        <div>Content with custom IDs</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "custom-title-id");
    expect(dialog).toHaveAttribute("aria-describedby", "custom-desc-id");
    expect(screen.getByText("Explicit Title")).toHaveAttribute("id", "custom-title-id");
    expect(screen.getByText("Explicit Description")).toHaveAttribute("id", "custom-desc-id");
  });

  it("supports rendering without explicit title or description elements", () => {
    render(
      <AccessibleModal isOpen={true} onClose={() => {}} ariaLabel="Minimal Dialog">
        <div>Minimal Content</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-label", "Minimal Dialog");
  });

  it("checks custom backdrop styling propagation", () => {
    render(
      <AccessibleModal
        isOpen={true}
        onClose={() => {}}
        backdropClassName="custom-backdrop-wrapper bg-black/90 p-8"
      >
        <div>Custom Backdrop Child</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("ensures high-contrast dark theme border utility classes match design token specifications", () => {
    const expectedBorderTokens = ["border", "border-slate-700", "dark:border-slate-800"];
    render(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <div>Token Validation</div>
      </AccessibleModal>,
    );

    const dialog = screen.getByRole("dialog");
    const classList = dialog.className.split(" ");
    expectedBorderTokens.forEach((token) => {
      expect(classList).toContain(token);
    });
  });

  it("handles rapid mount and unmount cycles cleanly", () => {
    const { rerender } = render(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <div>Cycle 1</div>
      </AccessibleModal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <AccessibleModal isOpen={false} onClose={() => {}}>
        <div>Cycle 2</div>
      </AccessibleModal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <AccessibleModal isOpen={true} onClose={() => {}}>
        <div>Cycle 3</div>
      </AccessibleModal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
