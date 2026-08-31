import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CollabPythonSandbox } from "../components/ui/CollabPythonSandbox";
import { usePythonSandbox } from "../hooks/usePythonSandbox";
import { useCodeReviews } from "../hooks/useCodeReviews";
import { useAuth } from "../features/auth/AuthContext";

// Mock Monaco editor to avoid pulling in the real editor in jsdom
vi.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: () => <div data-testid="monaco-editor" />,
}));

// Mock collaborative editing deps used during mount
vi.mock("yjs", () => ({
  Doc: vi.fn(() => ({
    getText: vi.fn(() => ({
      insert: vi.fn(),
      delete: vi.fn(),
      toString: () => "print('hi')",
      length: 1,
    })),
    destroy: vi.fn(),
  })),
}));

vi.mock("y-websocket", () => ({
  WebsocketProvider: vi.fn(() => ({
    awareness: {
      on: vi.fn(),
      setLocalStateField: vi.fn(),
      getStates: vi.fn(() => new Map()),
    },
    disconnect: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock("y-monaco", () => ({
  MonacoBinding: vi.fn(),
}));

vi.mock("randomcolor", () => ({
  __esModule: true,
  default: vi.fn(() => "#3b82f6"),
}));

// Mock the hooks and dependent components
vi.mock("../hooks/usePythonSandbox", () => ({
  usePythonSandbox: vi.fn(),
}));

vi.mock("../hooks/useCodeReviews", () => ({
  useCodeReviews: vi.fn(),
}));

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../components/ui/CodeReviewPanel", () => ({
  CodeReviewPanel: () => <div data-testid="code-review-panel" />,
}));

vi.mock("../components/ui/SnippetLibraryModal", () => ({
  SnippetLibraryModal: () => <div data-testid="snippet-library-modal" />,
}));

describe("CollabPythonSandbox output sanitization", () => {
  const defaultExercise = {
    prompt: "Print hello",
    starterCode: "print('hi')",
    testCode: "assert True",
    hint: "Use print",
  };

  const mockRunPythonCode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    (usePythonSandbox as any).mockReturnValue({
      isReady: true,
      isExecuting: false,
      runPythonCode: mockRunPythonCode,
    });

    (useCodeReviews as any).mockReturnValue({
      threads: [],
      addComment: vi.fn(),
      resolveThread: vi.fn(),
    });

    (useAuth as any).mockReturnValue({ user: { username: "tester" } });
  });

  afterEach(() => {
    cleanup();
  });

  it("displays plain execution output", async () => {
    mockRunPythonCode.mockResolvedValueOnce({
      output: "1 < 2 and 3 > 2",
      error: null,
    });

    render(
      <CollabPythonSandbox
        exercise={defaultExercise}
        onSuccess={vi.fn()}
        roomId="room-1"
      />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(screen.getByText("1 < 2 and 3 > 2")).toBeInTheDocument();
    });
  });

  it("strips script tags and event handlers from output", async () => {
    mockRunPythonCode.mockResolvedValueOnce({
      output:
        "<script>alert('xss')</script>\n<img src=x onerror=\"alert(1)\">\n<b>done</b>",
      error: null,
    });

    render(
      <CollabPythonSandbox
        exercise={defaultExercise}
        onSuccess={vi.fn()}
        roomId="room-1"
      />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(screen.getByText("done")).toBeInTheDocument();
    });

    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("[onerror]")).toBeNull();
  });

  it("strips script tags from runtime errors", async () => {
    mockRunPythonCode.mockResolvedValueOnce({
      output: "",
      error: "<script>alert('xss')</script>SyntaxError: bad token",
    });

    render(
      <CollabPythonSandbox
        exercise={defaultExercise}
        onSuccess={vi.fn()}
        roomId="room-1"
      />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(screen.getByText("SyntaxError: bad token")).toBeInTheDocument();
    });

    expect(document.querySelector("script")).toBeNull();
  });

  it("calls onSuccess when code runs without errors", async () => {
    const onSuccess = vi.fn();
    mockRunPythonCode.mockResolvedValueOnce({
      output: "All good",
      error: null,
    });

    render(
      <CollabPythonSandbox
        exercise={defaultExercise}
        onSuccess={onSuccess}
        roomId="room-1"
      />,
    );

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
