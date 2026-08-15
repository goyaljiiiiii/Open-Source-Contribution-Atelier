import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTimelineEngine } from "../hooks/useTimelineEngine";

describe("useTimelineEngine empty trace guard", () => {
  it("stepForward does not set negative index when traceEvents is empty", () => {
    const { result } = renderHook(() => useTimelineEngine());

    // traceEvents is empty by default
    expect(result.current.traceEvents).toHaveLength(0);
    expect(result.current.currentStepIndex).toBe(0);

    act(() => {
      result.current.stepForward();
    });

    // Should remain at 0, not become -1
    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentEvent).toBeNull();
  });

  it("stepBackward stays at 0 when traceEvents is empty", () => {
    const { result } = renderHook(() => useTimelineEngine());

    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("togglePlayback does nothing when traceEvents is empty", () => {
    const { result } = renderHook(() => useTimelineEngine());

    act(() => {
      result.current.togglePlayback();
    });

    // Should not crash or start playing
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStepIndex).toBe(0);
  });

  it("jumpToStep ignores out-of-bounds index on empty trace", () => {
    const { result } = renderHook(() => useTimelineEngine());

    act(() => {
      result.current.jumpToStep(5);
    });

    expect(result.current.currentStepIndex).toBe(0);
  });

  it("stepForward works correctly with loaded trace", () => {
    const { result } = renderHook(() => useTimelineEngine());

    const mockTrace = [
      { step: 0, line: 1, event: "call", locals: {}, stdout: "" },
      { step: 1, line: 2, event: "line", locals: {}, stdout: "" },
      { step: 2, line: 3, event: "return", locals: {}, stdout: "" },
    ];

    act(() => {
      result.current.loadTrace(mockTrace);
    });

    expect(result.current.traceEvents).toHaveLength(3);
    expect(result.current.currentStepIndex).toBe(0);

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStepIndex).toBe(2);

    // Should not go past the end
    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentStepIndex).toBe(2);
  });
});
