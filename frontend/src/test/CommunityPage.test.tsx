import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityPage } from "../pages/CommunityPage";

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});
vi.mock("../lib/api", () => ({
  fetchApi: vi.fn().mockResolvedValue({ results: [], next: null }),
}));
vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../components/ui/ResponsiveTable", () => ({
  ResponsiveTable: () => <div />,
}));
vi.mock("../components/chat/ChatContainer", () => ({
  ChatContainer: () => <div />,
}));
vi.mock("../components/community/CommunityFeed", () => ({
  CommunityFeed: () => <div />,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CommunityPage />
    </QueryClientProvider>,
  );
}

describe("CommunityPage statistics", () => {
  beforeEach(() => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    vi.stubGlobal(
      "WebSocket",
      class {
        close() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("preserves the loading skeleton with the loaded grid breakpoints", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = renderPage();
    const skeletonGrid =
      container.querySelector(".animate-pulse")?.parentElement;

    expect(skeletonGrid).toHaveClass(
      "grid",
      "gap-4",
      "sm:grid-cols-2",
      "lg:grid-cols-4",
    );
  });

  it("shows an unavailable state instead of fake statistics on error", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderPage();

    expect(
      screen.getByText("Community statistics are currently unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByText("128")).not.toBeInTheDocument();
    expect(screen.queryByText("342")).not.toBeInTheDocument();
    expect(screen.queryByText(/3\.2h/)).not.toBeInTheDocument();
  });

  it("shows unavailable for a missing statistic in a successful response", () => {
    useQueryMock.mockReturnValue({
      data: {
        merged_prs: 0,
        response_sla: 0,
        open_requests: 0,
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    const contributorsCard = screen.getByText(
      "Weekly active contributors",
    ).parentElement;
    expect(contributorsCard).not.toBeNull();
    expect(
      within(contributorsCard!).getByText("Unavailable"),
    ).toBeInTheDocument();

    for (const label of ["Merged learning PRs", "Open help requests"]) {
      const card = screen.getByText(label).parentElement;
      expect(card).not.toBeNull();
      expect(within(card!).getByText("0")).toBeInTheDocument();
    }

    const slaCard = screen.getByText("Mentor response SLA").parentElement;
    expect(slaCard).not.toBeNull();
    expect(within(slaCard!).getByText(/^0 /)).toBeInTheDocument();
  });

  it("keeps valid zero statistics visible", () => {
    useQueryMock.mockReturnValue({
      data: {
        active_contributors: 0,
        merged_prs: 0,
        response_sla: 0,
        open_requests: 0,
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    for (const label of [
      "Weekly active contributors",
      "Merged learning PRs",
      "Open help requests",
    ]) {
      const card = screen.getByText(label).parentElement;
      expect(card).not.toBeNull();
      expect(within(card!).getByText("0")).toBeInTheDocument();
    }

    const slaCard = screen.getByText("Mentor response SLA").parentElement;
    expect(slaCard).not.toBeNull();
    expect(within(slaCard!).getByText(/^0 /)).toBeInTheDocument();
  });
});
