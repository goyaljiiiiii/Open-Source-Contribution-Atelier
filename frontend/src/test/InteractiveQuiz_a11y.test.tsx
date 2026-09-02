import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InteractiveQuiz } from "../components/ui/plugins/InteractiveQuiz";
import React from "react";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      id: "quiz-1",
      question: "What does git commit --amend do?",
      options: [
        "Create a new branch",
        "Modify the tip commit",
        "Delete repository",
        "Rebase main"
      ],
      answer: 1,
      points: 15,
      explanation: "Amends the previous commit in place."
    },
    isLoading: false,
    error: null,
  }),
  useMutation: () => ({
    mutate: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("../hooks/useUserProgress", () => ({
  useUserProgress: () => ({
    progress: [],
    totalXP: 0,
    syncProgress: vi.fn(),
  }),
}));

vi.mock("../hooks/useQuizDraft", () => ({
  useQuizDraft: () => ({
    getDraft: () => null,
    saveDraft: vi.fn(),
    clearDraft: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("InteractiveQuiz Keyboard Arrow Navigation (Issue #2716)", () => {
  it("renders option list container with radiogroup role and options with radio role", () => {
    render(<InteractiveQuiz id="quiz-1" />);

    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toBeInTheDocument();

    const options = screen.getAllByRole("radio");
    expect(options.length).toBe(4);
    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options[1]).toHaveAttribute("tabindex", "-1");
  });

  it("navigates forward using ArrowDown and ArrowRight keys", () => {
    render(<InteractiveQuiz id="quiz-1" />);

    const radioGroup = screen.getByRole("radiogroup");
    const options = screen.getAllByRole("radio");

    // Press ArrowDown to select first option
    fireEvent.keyDown(radioGroup, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-checked", "true");

    // Press ArrowRight to move to second option
    fireEvent.keyDown(radioGroup, { key: "ArrowRight" });
    expect(options[1]).toHaveAttribute("aria-checked", "true");
    expect(options[1]).toHaveAttribute("tabindex", "0");
    expect(options[0]).toHaveAttribute("tabindex", "-1");
  });

  it("navigates backward using ArrowUp and ArrowLeft keys and wraps around", () => {
    render(<InteractiveQuiz id="quiz-1" />);

    const radioGroup = screen.getByRole("radiogroup");
    const options = screen.getAllByRole("radio");

    // Press ArrowUp when no option is selected wraps to last option
    fireEvent.keyDown(radioGroup, { key: "ArrowUp" });
    expect(options[3]).toHaveAttribute("aria-checked", "true");

    // Press ArrowLeft to move to previous option
    fireEvent.keyDown(radioGroup, { key: "ArrowLeft" });
    expect(options[2]).toHaveAttribute("aria-checked", "true");
  });
});
