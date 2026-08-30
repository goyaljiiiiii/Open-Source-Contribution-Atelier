import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CodeDiffViewer } from "../components/ui/CodeDiffViewer";
import * as useThemeHook from "../hooks/useTheme";

// Mock the useTheme hook
vi.mock("../hooks/useTheme", () => ({
  useTheme: vi.fn(),
}));

// Mock react-diff-viewer-continued
vi.mock("react-diff-viewer-continued", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("react-diff-viewer-continued")>();
  const MockDiffViewer = ({
    oldValue,
    newValue,
    splitView,
    useDarkTheme,
    renderGutter,
  }: any) => (
    <div data-testid="mock-diff-viewer">
      <div data-testid="old-value">{oldValue}</div>
      <div data-testid="new-value">{newValue}</div>
      <div data-testid="is-split-view">{splitView ? "true" : "false"}</div>
      <div data-testid="is-dark-theme">{useDarkTheme ? "true" : "false"}</div>
      <table>
        <tbody>
          <tr>
            {renderGutter?.({ lineNumber: 1, type: 2 })}
            <td>old</td>
          </tr>
          <tr>
            {renderGutter?.({ lineNumber: 1, type: 1 })}
            <td>new</td>
          </tr>
          <tr>
            {renderGutter?.({ lineNumber: 2, type: 0 })}
            <td>same</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
  return {
    ...actual,
    default: MockDiffViewer,
  };
});

describe("CodeDiffViewer", () => {
  beforeEach(() => {
    vi.mocked(useThemeHook.useTheme).mockReturnValue({ theme: "light" } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("should render successfully with original and modified code", () => {
    render(
      <CodeDiffViewer
        originalCode="const a = 1;"
        modifiedCode="const a = 2;"
      />,
    );

    expect(screen.getByText("Source Code Changes")).toBeInTheDocument();
    expect(screen.getByText("submission.code")).toBeInTheDocument();
    expect(screen.getByTestId("old-value")).toHaveTextContent("const a = 1;");
    expect(screen.getByTestId("new-value")).toHaveTextContent("const a = 2;");
  });

  it("should toggle between split and unified views correctly", () => {
    render(<CodeDiffViewer originalCode="code A" modifiedCode="code B" />);

    const splitViewElement = screen.getByTestId("is-split-view");
    expect(splitViewElement).toHaveTextContent("true"); // Default is true

    // Click Unified View
    const unifiedBtn = screen.getByTitle("Unified View (1-column)");
    fireEvent.click(unifiedBtn);
    expect(splitViewElement).toHaveTextContent("false");

    // Click Split View
    const splitBtn = screen.getByTitle("Split View (2-column)");
    fireEvent.click(splitBtn);
    expect(splitViewElement).toHaveTextContent("true");
  });

  it("should keep original and modified code aligned in both split and unified views", () => {
    render(
      <CodeDiffViewer
        originalCode="const a = 1;"
        modifiedCode="const b = 2;"
      />,
    );

    const splitViewElement = screen.getByTestId("is-split-view");
    expect(splitViewElement).toHaveTextContent("true");
    expect(screen.getByTestId("old-value")).toHaveTextContent("const a = 1;");
    expect(screen.getByTestId("new-value")).toHaveTextContent("const b = 2;");

    // Switching to unified layout must preserve the exact same code lines
    // so highlight alignment carries across both modes.
    fireEvent.click(screen.getByTitle("Unified View (1-column)"));
    expect(splitViewElement).toHaveTextContent("false");
    expect(screen.getByTestId("old-value")).toHaveTextContent("const a = 1;");
    expect(screen.getByTestId("new-value")).toHaveTextContent("const b = 2;");
  });

  it("should announce the active view mode with aria-pressed", () => {
    render(<CodeDiffViewer originalCode="code A" modifiedCode="code B" />);

    const splitBtn = screen.getByRole("button", {
      name: /Split View/,
    });
    const unifiedBtn = screen.getByRole("button", {
      name: /Unified View/,
    });

    expect(splitBtn).toHaveAttribute("aria-pressed", "true");
    expect(unifiedBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(unifiedBtn);

    expect(splitBtn).toHaveAttribute("aria-pressed", "false");
    expect(unifiedBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("should correctly handle dark theme from useTheme", () => {
    vi.mocked(useThemeHook.useTheme).mockReturnValue({ theme: "dark" } as any);

    render(<CodeDiffViewer originalCode="dark1" modifiedCode="dark2" />);

    expect(screen.getByTestId("is-dark-theme")).toHaveTextContent("true");
  });

  it("should render with custom title and filename", () => {
    render(
      <CodeDiffViewer
        originalCode="x"
        modifiedCode="y"
        title="Custom Title"
        fileName="custom.js"
      />,
    );

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("custom.js")).toBeInTheDocument();
  });

  it("should prefix changed lines with screen reader addition/deletion labels", () => {
    render(<CodeDiffViewer originalCode="old" modifiedCode="new" />);

    const deletionLabel = screen.getByText("Deletion:");
    expect(deletionLabel).toHaveClass("sr-only");

    const additionLabel = screen.getByText("Addition:");
    expect(additionLabel).toHaveClass("sr-only");

    // Unchanged lines must not receive a diff label.
    expect(screen.queryByText("Modification:")).not.toBeInTheDocument();
  });
});
