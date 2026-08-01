import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WeeklyGoalTracker } from "../components/dashboard/WeeklyGoalTracker";
import * as api from "../lib/api";

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

const mockGoalData = {
  id: 1,
  week_start_date: "2026-07-27",
  week_end_date: "2026-08-02",
  target_lessons: 5,
  target_xp: 500,
  target_minutes: 120,
  completed_lessons: 3,
  earned_xp: 350,
  minutes_spent: 90,
  lessons_progress_pct: 60,
  xp_progress_pct: 70,
  minutes_progress_pct: 75,
  overall_progress_pct: 68,
  daily_breakdown: [
    { day_name: "Mon", date: "2026-07-27", is_active: true, is_today: false, is_future: false },
    { day_name: "Tue", date: "2026-07-28", is_active: true, is_today: false, is_future: false },
    { day_name: "Wed", date: "2026-07-29", is_active: false, is_today: false, is_future: false },
    { day_name: "Thu", date: "2026-07-30", is_active: true, is_today: false, is_future: false },
    { day_name: "Fri", date: "2026-07-31", is_active: true, is_today: true, is_future: false },
    { day_name: "Sat", date: "2026-08-01", is_active: false, is_today: false, is_future: true },
    { day_name: "Sun", date: "2026-08-02", is_active: false, is_today: false, is_future: true },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("WeeklyGoalTracker Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton initially", () => {
    vi.mocked(api.fetchApi).mockImplementation(() => new Promise(() => {}));
    const { container } = renderWithClient(<WeeklyGoalTracker />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders weekly learning goal metrics correctly", async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(mockGoalData);

    renderWithClient(<WeeklyGoalTracker />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Learning Goal")).toBeInTheDocument();
    });

    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("350 / 500")).toBeInTheDocument();
    expect(screen.getByText("90m / 120m")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
  });

  it("opens edit goal modal on clicking Edit Goal button", async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(mockGoalData);

    renderWithClient(<WeeklyGoalTracker />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Learning Goal")).toBeInTheDocument();
    });

    const editBtn = screen.getByText("Edit Goal");
    fireEvent.click(editBtn);

    expect(screen.getByText("Adjust Weekly Goal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
    expect(screen.getByDisplayValue("120")).toBeInTheDocument();
  });
});
