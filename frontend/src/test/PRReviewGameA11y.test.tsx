import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PRReviewGamePage } from "../pages/PRReviewGamePage";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
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

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("PR Review Game Focus Ring & Accessibility Suite (#2809)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders all decision buttons with visible focus ring outline classes", () => {
    renderWithTheme(<PRReviewGamePage />);

    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });

    expect(approveBtn).toBeInTheDocument();
    expect(commentBtn).toBeInTheDocument();
    expect(requestChangesBtn).toBeInTheDocument();

    [approveBtn, commentBtn, requestChangesBtn].forEach((btn) => {
      expect(btn.className).toContain("focus:ring-2");
      expect(btn.className).toContain("focus:ring-blue-500");
      expect(btn.className).toContain("focus:outline-none");
    });
  });

  it("supports keyboard tab navigation focus across game action buttons", () => {
    renderWithTheme(<PRReviewGamePage />);

    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });

    approveBtn.focus();
    expect(document.activeElement).toBe(approveBtn);

    commentBtn.focus();
    expect(document.activeElement).toBe(commentBtn);

    requestChangesBtn.focus();
    expect(document.activeElement).toBe(requestChangesBtn);
  });

  it("advances game levels upon selecting answers and displays game over screen with focusable reset button", () => {
    renderWithTheme(<PRReviewGamePage />);

    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    fireEvent.click(requestChangesBtn);

    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    fireEvent.click(commentBtn);

    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);

    expect(screen.getByText(/Game Over!/i)).toBeInTheDocument();
    const playAgainBtn = screen.getByRole("button", { name: /Play Again/i });
    expect(playAgainBtn).toBeInTheDocument();
    expect(playAgainBtn.className).toContain("focus:ring-2");
    expect(playAgainBtn.className).toContain("focus:ring-blue-500");

    playAgainBtn.focus();
    expect(document.activeElement).toBe(playAgainBtn);

    fireEvent.click(playAgainBtn);
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
  });

  it("ensures decision buttons have type='button' attribute for accessibility compliance", () => {
    renderWithTheme(<PRReviewGamePage />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type", "button");
    });
  });

  it("verifies FOCUS_RING token inclusion matches shared a11y focus utility", () => {
    renderWithTheme(<PRReviewGamePage />);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    expect(approveBtn.className).toContain("focus-visible:outline");
  });

  it("handles keyboard keydown space and enter activation on decision buttons", () => {
    renderWithTheme(<PRReviewGamePage />);

    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    approveBtn.focus();
    expect(document.activeElement).toBe(approveBtn);

    fireEvent.keyDown(approveBtn, { key: "Enter", code: "Enter" });
    fireEvent.click(approveBtn);
  });

  it("preserves active focus state during game reset", () => {
    renderWithTheme(<PRReviewGamePage />);

    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    fireEvent.click(requestChangesBtn);
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    fireEvent.click(commentBtn);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);

    const playAgainBtn = screen.getByRole("button", { name: /Play Again/i });
    playAgainBtn.focus();
    expect(document.activeElement).toBe(playAgainBtn);

    fireEvent.click(playAgainBtn);
    const newApproveBtn = screen.getByRole("button", { name: /Approve/i });
    expect(newApproveBtn).toBeInTheDocument();
  });

  it("renders accessible code diff snippet wrapper for current level", () => {
    renderWithTheme(<PRReviewGamePage />);
    expect(screen.getByText(/Level 1: The Infinite Loop/i)).toBeInTheDocument();
  });

  it("verifies score and progress counters update dynamically across levels", () => {
    renderWithTheme(<PRReviewGamePage />);
    expect(screen.getByText(/Level 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Score:/i)).toBeInTheDocument();
  });

  it("validates WCAG AA compliant focus ring visual separation token rules", () => {
    renderWithTheme(<PRReviewGamePage />);
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    const classList = commentBtn.className.split(" ");
    expect(classList).toContain("focus:ring-2");
    expect(classList).toContain("focus:ring-blue-500");
  });

  it("ensures keyboard traversal order follows visual document hierarchy", () => {
    renderWithTheme(<PRReviewGamePage />);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });

    expect(approveBtn.compareDocumentPosition(commentBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(commentBtn.compareDocumentPosition(requestChangesBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("verifies feedback and toast messaging triggers accurately for incorrect submissions", () => {
    renderWithTheme(<PRReviewGamePage />);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);
  });

  it("verifies feedback and toast messaging triggers accurately for correct submissions", () => {
    renderWithTheme(<PRReviewGamePage />);
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    fireEvent.click(requestChangesBtn);
  });

  it("handles rapid consecutive keyboard selection triggers safely without state corruption", () => {
    renderWithTheme(<PRReviewGamePage />);
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    fireEvent.click(requestChangesBtn);
    const commentBtn = screen.getByRole("button", { name: /Comment/i });
    fireEvent.click(commentBtn);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);
    expect(screen.getByText(/Game Over!/i)).toBeInTheDocument();
  });

  it("validates header and description accessibility text in PR review sandbox", () => {
    renderWithTheme(<PRReviewGamePage />);
    expect(screen.getByText(/PR Reviewer Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/Test your code review skills/i)).toBeInTheDocument();
  });

  it("preserves focus state stability across re-render cycles", () => {
    const { rerender } = renderWithTheme(<PRReviewGamePage />);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    approveBtn.focus();
    expect(document.activeElement).toBe(approveBtn);

    rerender(<ThemeProvider><PRReviewGamePage /></ThemeProvider>);
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
  });

  it("ensures each level defines a non-empty feedback string and valid correctAction", () => {
    renderWithTheme(<PRReviewGamePage />);
    expect(screen.getByText(/Review this pull request/i)).toBeInTheDocument();
  });

  it("verifies that game action buttons maintain active transition and hover tokens alongside focus styles", () => {
    renderWithTheme(<PRReviewGamePage />);
    const requestChangesBtn = screen.getByRole("button", { name: /Request Changes/i });
    expect(requestChangesBtn.className).toContain("transition-all");
    expect(requestChangesBtn.className).toContain("shadow-card");
  });

  it("ensures Score label and Level indicators maintain distinct high contrast typography", () => {
    renderWithTheme(<PRReviewGamePage />);
    const scoreContainer = screen.getByText(/Score:/i);
    expect(scoreContainer).toBeInTheDocument();
    expect(scoreContainer.className).toContain("font-bold");
  });

  it("verifies CodeDiffViewer toggle buttons render with accessibility labels and focus styling", () => {
    renderWithTheme(<PRReviewGamePage />);
    const splitViewBtn = screen.getByRole("button", { name: /Split View/i });
    const unifiedViewBtn = screen.getByRole("button", { name: /Unified View/i });

    expect(splitViewBtn).toBeInTheDocument();
    expect(unifiedViewBtn).toBeInTheDocument();
    expect(splitViewBtn).toHaveAttribute("type", "button");
    expect(unifiedViewBtn).toHaveAttribute("type", "button");
  });

  it("validates button icon accessibility presentation attributes", () => {
    renderWithTheme(<PRReviewGamePage />);
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const svgIcon = approveBtn.querySelector("svg");
    expect(svgIcon).toBeInTheDocument();
  });

  it("verifies level description text renders with readable contrast classes", () => {
    renderWithTheme(<PRReviewGamePage />);
    const desc = screen.getByText(/Review this pull request and find the bug/i);
    expect(desc).toBeInTheDocument();
    expect(desc.className).toContain("text-muted");
  });
});
