import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscussionSearchInput } from "../components/community/DiscussionSearchInput";

describe("DiscussionSearchInput", () => {
  let handleChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handleChange = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  function renderInput() {
    render(<DiscussionSearchInput value="" onChange={handleChange} />);
    return screen.getByRole("textbox") as HTMLInputElement;
  }

  it("dispatches a single debounced onChange after typing stops", () => {
    const input = renderInput();

    fireEvent.change(input, { target: { value: "react" } });
    fireEvent.change(input, { target: { value: "react q" } });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("react q");
  });

  it("suppresses intermediate queries during IME composition", () => {
    const input = renderInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "に" } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "日本語" } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("日本語");
  });

  it("dispatches normally for typing after composition ends", () => {
    const input = renderInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "か" } });
    fireEvent.compositionEnd(input);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("か");

    fireEvent.change(input, { target: { value: "かx" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(handleChange).toHaveBeenCalledTimes(2);
    expect(handleChange).toHaveBeenLastCalledWith("かx");
  });

  it("cancels pending dispatch when composition starts mid-debounce", () => {
    const input = renderInput();

    fireEvent.change(input, { target: { value: "hi" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.compositionStart(input);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("clears the pending timer on unmount", () => {
    const input = renderInput();

    fireEvent.change(input, { target: { value: "pending" } });
    cleanup();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleChange).not.toHaveBeenCalled();
  });
});
