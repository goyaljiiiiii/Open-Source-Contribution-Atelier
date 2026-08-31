import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnalyticsDashboardPage, {
  RegistrationTrendsChart,
  CourseEngagementChart,
  QuizAccuracyChart,
  ChallengeStatusChart,
} from "../pages/AnalyticsDashboardPage";
import { ThemeProvider } from "../context/ThemeContext";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
  API_BASE: "http://localhost:8000/api",
}));

const mockAnalyticsData = {
  registrations: [
    { date: "2026-08-01", count: 12 },
    { date: "2026-08-02", count: 18 },
  ],
  progress_stats: [
    { date: "2026-08-01", enrolled: 25, completed: 15 },
    { date: "2026-08-02", enrolled: 30, completed: 22 },
  ],
  quiz_stats: [
    { is_correct: true, count: 85 },
    { is_correct: false, count: 15 },
  ],
  challenge_stats: [
    { status: "passed", count: 42 },
    { status: "failed", count: 8 },
  ],
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
};

describe("Analytics Dashboard Memoized Recharts Components (#2723)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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
    vi.spyOn(api, "fetchApi").mockResolvedValue(mockAnalyticsData);
  });

  afterEach(() => {
    cleanup();
  });

  describe("Subcomponent Empty State Guards", () => {
    it("renders fallback text when registration data is empty", () => {
      render(<RegistrationTrendsChart data={[]} theme="light" />);
      expect(screen.getByText("No data for the selected period")).toBeDefined();
    });

    it("renders fallback text when course engagement data is empty", () => {
      render(<CourseEngagementChart data={[]} theme="light" />);
      expect(screen.getByText("No data for the selected period")).toBeDefined();
    });

    it("renders fallback text when quiz data is empty", () => {
      render(<QuizAccuracyChart quizData={[]} totalQuizCount={0} theme="light" />);
      expect(screen.getByText("No data for the selected period")).toBeDefined();
    });

    it("renders fallback text when challenge data is empty", () => {
      render(<ChallengeStatusChart data={[]} totalChallengeCount={0} theme="light" />);
      expect(screen.getByText("No data for the selected period")).toBeDefined();
    });
  });

  describe("AnalyticsDashboardPage Tab Navigation and Memoization", () => {
    it("renders all overview metric sections upon loading", async () => {
      renderWithProviders(<AnalyticsDashboardPage />);

      expect(await screen.findByText("Platform Analytics")).toBeDefined();
      expect(screen.getByRole("heading", { name: /New Registrations/i })).toBeDefined();
      expect(screen.getByRole("heading", { name: /Course Engagement/i })).toBeDefined();
      expect(screen.getByRole("heading", { name: /Quiz Accuracy/i })).toBeDefined();
      expect(screen.getByRole("heading", { name: /Challenge Submissions Status/i })).toBeDefined();
    });

    it("switches tabs to isolate specific charts", async () => {
      renderWithProviders(<AnalyticsDashboardPage />);

      expect(await screen.findByText("Platform Analytics")).toBeDefined();

      // Click Quiz Accuracy tab
      const quizzesTab = screen.getByRole("tab", { name: "Quiz Accuracy" });
      fireEvent.click(quizzesTab);

      expect(screen.getByRole("heading", { name: /Quiz Accuracy/i })).toBeDefined();
      expect(screen.queryByRole("heading", { name: /New Registrations/i })).toBeNull();
    });

    it("triggers CSV export for individual datasets", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      renderWithProviders(<AnalyticsDashboardPage />);

      expect(await screen.findByText("Platform Analytics")).toBeDefined();

      const exportAllBtn = screen.getByRole("button", { name: /Export all analytics metrics to CSV/i });
      fireEvent.click(exportAllBtn);

      expect(openSpy).toHaveBeenCalledWith(
        "http://localhost:8000/api/dashboard/analytics/export/?dataset=all&days=30",
        "_blank",
      );
    });
  });
});
