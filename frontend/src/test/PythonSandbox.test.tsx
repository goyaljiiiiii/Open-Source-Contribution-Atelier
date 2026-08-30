import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PythonSandbox } from "../components/ui/PythonSandbox";
import { usePythonSandbox } from "../hooks/usePythonSandbox";

// Mock the hook
vi.mock("../hooks/usePythonSandbox", () => ({
  usePythonSandbox: vi.fn(),
}));

// react-resizable-panels relies on real DOM measurement (ResizeObserver) that
// is unavailable in jsdom; mock it to a passthrough so sandbox UI tests can run.
vi.mock("react-resizable-panels", () => ({
  Group: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="resizable-group" {...props}>
      {children}
    </div>
  ),
  Panel: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel" {...props}>
      {children}
    </div>
  ),
  Separator: (props: Record<string, unknown>) => (
    <div data-testid="resizable-separator" {...props} />
  ),
  useDefaultLayout: () => ({
    defaultLayout: undefined,
    onLayoutChange: vi.fn(),
  }),
}));

describe("PythonSandbox UI", () => {
  const mockOnSuccess = vi.fn();
  const defaultExercise = {
    prompt: "Print hello",
    starterCode: "print('hi')",
    testCode: "assert True",
    hint: "Use print",
  };

  const mockRunPythonCode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (usePythonSandbox as any).mockReturnValue({
      isReady: true,
      isExecuting: false,
      runPythonCode: mockRunPythonCode,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders correctly with starter code", () => {
    render(
      <PythonSandbox exercise={defaultExercise} onSuccess={mockOnSuccess} />,
    );
    expect(screen.getByText("Print hello")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("displays execution output", async () => {
    mockRunPythonCode.mockResolvedValueOnce({ output: "hello", error: null });

    render(
      <PythonSandbox exercise={defaultExercise} onSuccess={mockOnSuccess} />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });

  it("displays syntax errors properly", async () => {
    mockRunPythonCode.mockResolvedValueOnce({
      output: "",
      error: "SyntaxError: invalid syntax",
    });

    render(
      <PythonSandbox exercise={defaultExercise} onSuccess={mockOnSuccess} />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(
        screen.getByText("SyntaxError: invalid syntax"),
      ).toBeInTheDocument();
    });
  });

  it("handles testCode assertions and calls onSuccess", async () => {
    // Both user code and test code succeed
    mockRunPythonCode.mockResolvedValueOnce({
      output: "tests passed",
      error: null,
    });

    render(
      <PythonSandbox exercise={defaultExercise} onSuccess={mockOnSuccess} />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
