import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DailyChallengeQuizCard } from "../components/ui/DailyChallengeQuizCard";

// Mock useCurriculum hook
vi.mock("../hooks/useCurriculum", () => ({
  useCurriculum: () => ({
    data: {
      modules: [
        {
          id: "mod-1",
          title: "Module 1",
          lessons: [
            {
              slug: "test-lesson",
              title: "Test Lesson",
              quizzes: [
                {
                  question: "What is Git?",
                  options: ["A VCS", "A browser", "An OS", "A language"],
                  answer: 0,
                  explanation: "Git is a distributed version control system.",
                },
              ],
            },
          ],
        },
      ],
    },
    isLoading: false,
  }),
}));

// Mock fetchApi
const mockFetchApi = vi.fn().mockResolvedValue({ status: "success" });
vi.mock("../lib/api", () => ({
  fetchApi: (...args: any[]) => mockFetchApi(...args),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("DailyChallengeQuizCard", () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const storageKey = `daily_challenge_quiz_${todayStr}`;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders daily challenge quiz card with question and option buttons", () => {
    renderWithClient(<DailyChallengeQuizCard />);

    expect(screen.getByText("Daily Brain Boost")).toBeInTheDocument();
    expect(screen.getByText("Daily Challenge")).toBeInTheDocument();
    expect(screen.getByText("What is Git?")).toBeInTheDocument();
    expect(screen.getByText("A VCS")).toBeInTheDocument();
    expect(screen.getByText("A browser")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Answer" })).toBeDisabled();
  });

  it("allows selecting an option and submitting answer for immediate feedback and XP reward", async () => {
    renderWithClient(<DailyChallengeQuizCard />);

    const correctOptionBtn = screen.getByText("A VCS");
    fireEvent.click(correctOptionBtn);

    const submitBtn = screen.getByRole("button", { name: "Submit Answer" });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Correct! Well done!/i)).toBeInTheDocument();
    expect(screen.getByText("Git is a distributed version control system.")).toBeInTheDocument();
    expect(
      screen.getByText("You've completed today's challenge! Come back tomorrow for a new question.")
    ).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    expect(stored.completed).toBe(true);
    expect(stored.selectedOption).toBe(0);
  });

  it("restores completed 'come back tomorrow' state from localStorage", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        completed: true,
        selectedOption: 0,
        earnedXp: 15,
        date: todayStr,
      })
    );

    renderWithClient(<DailyChallengeQuizCard />);

    expect(screen.getByText("Done for today")).toBeInTheDocument();
    expect(
      screen.getByText("You've completed today's challenge! Come back tomorrow for a new question.")
    ).toBeInTheDocument();
  });
});
