import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { PythonSandbox } from "../components/ui/PythonSandbox";
import { RustSandbox } from "../components/ui/RustSandbox";

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

    const outputRegion = screen.getByRole("region", { name: /console output/i });
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

    const outputRegion = screen.getByRole("region", { name: /console output/i });
    expect(outputRegion).toBeInTheDocument();
    expect(outputRegion).toHaveAttribute("aria-live", "polite");
    expect(outputRegion).toHaveAttribute("aria-atomic", "false");
  });
});
