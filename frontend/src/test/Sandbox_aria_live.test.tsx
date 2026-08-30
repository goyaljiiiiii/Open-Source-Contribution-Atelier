import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { PythonSandbox } from "../components/ui/PythonSandbox";
import { RustSandbox } from "../components/ui/RustSandbox";
import { GitTerminal } from "../components/ui/GitTerminal";
import { GitTerminal as StandaloneGitTerminal } from "../components/GitTerminal";
import { WASMTerminal } from "../features/sandbox/components/WASMTerminal";
import { TerminalReplay } from "../components/ui/TerminalReplay";

vi.mock("../hooks/usePythonSandbox", () => ({
  usePythonSandbox: () => ({
    isReady: true,
    isExecuting: false,
    runPythonCode: vi.fn(),
  }),
}));
vi.mock("../hooks/useTimelineEngine", () => ({
  useTimelineEngine: () => ({
    traceEvents: [],
    currentStepIndex: 0,
    currentEvent: null,
    isPlaying: false,
    playbackSpeed: 1,
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    jumpToStep: vi.fn(),
    togglePlayback: vi.fn(),
    setPlaybackSpeed: vi.fn(),
    loadTrace: vi.fn(),
    clearTrace: vi.fn(),
  }),
}));
vi.mock("../hooks/useGitShell", () => ({
  useGitShell: () => ({
    lines: [{ id: "1", kind: "info", text: "Welcome to Git terminal" }],
    shellState: { editorState: null },
    runCmd: vi.fn(),
    resetShell: vi.fn(),
    navigateHistory: vi.fn(),
    getHistoryEntry: vi.fn().mockReturnValue(""),
    historyIdx: -1,
    saveEditor: vi.fn(),
    closeEditor: vi.fn(),
  }),
}));
vi.mock("../hooks/useTerminalAutocomplete", () => ({
  useTerminalAutocomplete: () => ({
    suggestions: [],
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    commonCompletionPrefix: "",
  }),
}));
vi.mock("../features/sandbox/hooks/useGitSandbox", () => ({
  useGitSandbox: () => ({
    cwd: "/workspace",
    lines: [{ id: "1", kind: "output", text: "Sandbox initial output" }],
    branch: "main",
    initialized: true,
    execute: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("../components/ui/ExecutionTimelineVisualizer", () => ({
  ExecutionTimelineVisualizer: () => <div data-testid="mock-timeline" />,
}));
vi.mock("react-simple-code-editor", () => ({
  default: () => <div data-testid="mock-simple-editor" />,
}));

describe("Sandbox ARIA live regions and accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders PythonSandbox with accessible live region for console output", () => {
    const mockExercise = {
      id: "py-1",
      starterCode: "print('hello')",
      prompt: "Write Python code",
    };

    render(<PythonSandbox exercise={mockExercise} onSuccess={vi.fn()} />);

    const outputRegion = screen.getByRole("region", {
      name: /console output/i,
    });
    expect(outputRegion).toBeInTheDocument();
    expect(outputRegion).toHaveAttribute("aria-live", "polite");
    expect(outputRegion).toHaveAttribute("aria-atomic", "false");
  });

  it("renders RustSandbox with accessible live region for console output", () => {
    const mockExercise = {
      id: "rs-1",
      starterCode: "fn main() {}",
      prompt: "Write Rust code",
    };

    render(<RustSandbox exercise={mockExercise} onSuccess={vi.fn()} />);

    const outputRegion = screen.getByRole("region", {
      name: /console output/i,
    });
    expect(outputRegion).toBeInTheDocument();
    expect(outputRegion).toHaveAttribute("aria-live", "polite");
    expect(outputRegion).toHaveAttribute("aria-atomic", "false");
  });

  it("renders GitTerminal with accessible live region for terminal output log", () => {
    render(<GitTerminal />);

    const outputLog = screen.getByRole("log", { name: /terminal output/i });
    expect(outputLog).toBeInTheDocument();
    expect(outputLog).toHaveAttribute("aria-live", "polite");
    expect(outputLog).toHaveAttribute("aria-atomic", "false");
  });

  it("renders Standalone GitTerminal with accessible live region for terminal output", () => {
    render(<StandaloneGitTerminal />);

    const outputLog = screen.getByRole("log", { name: /terminal output/i });
    expect(outputLog).toBeInTheDocument();
    expect(outputLog).toHaveAttribute("aria-live", "polite");
    expect(outputLog).toHaveAttribute("aria-atomic", "false");
  });

  it("renders WASMTerminal with accessible live region for terminal output log", () => {
    render(<WASMTerminal />);

    const outputLog = screen.getByRole("log", { name: /terminal output/i });
    expect(outputLog).toBeInTheDocument();
    expect(outputLog).toHaveAttribute("aria-live", "polite");
    expect(outputLog).toHaveAttribute("aria-atomic", "false");
  });

  it("renders TerminalReplay with accessible live region for terminal output log", () => {
    const mockCommands = [{ command: "git status", output: "On branch main" }];
    render(
      <TerminalReplay sessionName="Test Replay" commands={mockCommands} />,
    );

    const outputLog = screen.getByRole("log", { name: /terminal output/i });
    expect(outputLog).toBeInTheDocument();
    expect(outputLog).toHaveAttribute("aria-live", "polite");
    expect(outputLog).toHaveAttribute("aria-atomic", "false");
  });
});
