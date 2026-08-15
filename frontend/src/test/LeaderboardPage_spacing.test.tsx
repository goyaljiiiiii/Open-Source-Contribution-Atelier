import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeaderboardPage } from "../pages/LeaderboardPage";

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { username: "testuser" } }),
}));

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn().mockResolvedValue({ leaderboard: [], total_users: 0, total_pages: 1 }),
}));

describe("LeaderboardPage layout spacing", () => {
  it("renders with optimized pt-6 top padding", () => {
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LeaderboardPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const mainContainer = container.querySelector(".max-w-5xl");
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer?.className).toContain("pt-6");
    expect(mainContainer?.className).not.toContain("pt-28");
  });
});
