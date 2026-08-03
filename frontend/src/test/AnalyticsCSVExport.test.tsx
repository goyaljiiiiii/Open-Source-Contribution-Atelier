import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnalyticsDashboardPage from "../pages/AnalyticsDashboardPage";
import { ThemeProvider } from "../context/ThemeContext";
import * as apiModule from "../lib/api";

describe("AnalyticsCSVExport Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    vi.spyOn(apiModule, "fetchApi").mockResolvedValue({
      registrations: [{ date: "2026-07-27", count: 12 }],
      progress_stats: [{ date: "2026-07-27", enrolled: 15, completed: 8 }],
      quiz_stats: [{ is_correct: true, count: 20 }],
      challenge_stats: [{ status: "PASSED", count: 10 }],
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
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

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AnalyticsDashboardPage />
        </ThemeProvider>
      </QueryClientProvider>
    );

  it("renders Export All CSV and per-widget Export CSV buttons", async () => {
    renderComponent();

    const exportAllButton = await screen.findByRole("button", {
      name: "Export all analytics metrics to CSV",
    });
    expect(exportAllButton).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Export Registrations to CSV" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Course Engagement to CSV" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Quiz Accuracy to CSV" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Challenge Submissions to CSV" })
    ).toBeInTheDocument();
  });

  it("triggers window.open when Export CSV buttons are clicked", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    renderComponent();

    const exportRegistrationsBtn = await screen.findByRole("button", {
      name: "Export Registrations to CSV",
    });
    fireEvent.click(exportRegistrationsBtn);

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock.mock.calls[0][0]).toContain("dataset=registrations");
  });
});
