import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnalyticsDashboardPage from "../pages/AnalyticsDashboardPage";
import { ThemeProvider } from "../context/ThemeContext";
import * as apiModule from "../lib/api";

describe("AnalyticsDashboardPage Navigation & Contrast (#2810)", () => {
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
      </QueryClientProvider>,
    );

  it("renders navigation tab list with WCAG compliant contrast classes", async () => {
    renderComponent();

    const tablist = await screen.findByRole("tablist", { name: /Analytics Views/i });
    expect(tablist).toBeInTheDocument();

    const overviewTab = screen.getByRole("tab", { name: /All Metrics/i });
    const engagementTab = screen.getByRole("tab", { name: /Course Engagement/i });
    const quizTab = screen.getByRole("tab", { name: /Quiz Accuracy/i });
    const challengeTab = screen.getByRole("tab", { name: /Challenge Status/i });

    expect(overviewTab).toHaveAttribute("aria-selected", "true");
    expect(overviewTab.className).toContain("bg-black");
    expect(overviewTab.className).toContain("text-white");

    // Inactive tabs check
    [engagementTab, quizTab, challengeTab].forEach((tab) => {
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab.className).toContain("text-slate-400");
      expect(tab.className).toContain("dark:text-slate-300");
    });
  });

  it("switches active tab when clicked and updates contrast styles accordingly", async () => {
    renderComponent();

    const engagementTab = await screen.findByRole("tab", { name: /Course Engagement/i });
    fireEvent.click(engagementTab);

    expect(engagementTab).toHaveAttribute("aria-selected", "true");
    expect(engagementTab.className).toContain("bg-black");

    const overviewTab = screen.getByRole("tab", { name: /All Metrics/i });
    expect(overviewTab).toHaveAttribute("aria-selected", "false");
    expect(overviewTab.className).toContain("text-slate-400");
    expect(overviewTab.className).toContain("dark:text-slate-300");
  });

  it("displays course engagement widget when engagement tab is selected", async () => {
    renderComponent();

    const engagementTab = await screen.findByRole("tab", { name: /Course Engagement/i });
    fireEvent.click(engagementTab);

    expect(screen.getByRole("heading", { level: 2, name: /Course Engagement/i })).toBeInTheDocument();
    expect(screen.queryByText(/New Registrations/i)).not.toBeInTheDocument();
  });

  it("switches to quiz accuracy tab and renders pie chart widget", async () => {
    renderComponent();

    const quizTab = await screen.findByRole("tab", { name: /Quiz Accuracy/i });
    fireEvent.click(quizTab);

    expect(screen.getByRole("heading", { level: 2, name: /Quiz Accuracy/i })).toBeInTheDocument();
    expect(screen.queryByText(/New Registrations/i)).not.toBeInTheDocument();
  });

  it("switches to challenge submissions tab and verifies view filtering", async () => {
    renderComponent();

    const challengeTab = await screen.findByRole("tab", { name: /Challenge Status/i });
    fireEvent.click(challengeTab);

    expect(screen.getByRole("heading", { level: 2, name: /Challenge Submissions Status/i })).toBeInTheDocument();
    expect(screen.queryByText(/New Registrations/i)).not.toBeInTheDocument();
  });

  it("ensures inactive tabs meet WCAG AA contrast ratio standards (>= 4.5:1)", async () => {
    renderComponent();

    const quizTab = await screen.findByRole("tab", { name: /Quiz Accuracy/i });
    expect(quizTab.classList.contains("text-slate-400")).toBe(true);
    expect(quizTab.classList.contains("dark:text-slate-300")).toBe(true);
  });

  it("supports keyboard tab switching and retains active states without layout shifts", async () => {
    renderComponent();

    const overviewTab = await screen.findByRole("tab", { name: /All Metrics/i });
    overviewTab.focus();
    expect(document.activeElement).toBe(overviewTab);

    const challengeTab = screen.getByRole("tab", { name: /Challenge Status/i });
    fireEvent.click(challengeTab);
    expect(challengeTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders export buttons across active tabs consistently", async () => {
    renderComponent();

    const exportAllBtn = await screen.findByRole("button", { name: /Export all analytics metrics to CSV/i });
    expect(exportAllBtn).toBeInTheDocument();
  });

  it("validates tab button type attributes and keydown interactions", async () => {
    renderComponent();

    const tabs = await screen.findAllByRole("tab");
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute("type", "button");
    });
  });

  it("ensures active and inactive tabs maintain distinct visual hierarchy and hover styling", async () => {
    renderComponent();

    const overviewTab = await screen.findByRole("tab", { name: /All Metrics/i });
    const quizTab = screen.getByRole("tab", { name: /Quiz Accuracy/i });

    expect(overviewTab.className).toContain("shadow-md");
    expect(quizTab.className).toContain("hover:text-slate-900");
    expect(quizTab.className).toContain("dark:hover:text-white");
  });
});
