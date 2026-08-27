import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShopPage } from "../pages/ShopPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import * as apiModule from "../lib/api";

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("ShopPage Streak Freeze Shield Integration (#2815)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    cleanup();
    localStorage.clear();
    localStorage.setItem("equipped_shop_items", "[]");
    localStorage.setItem("user_custom_xp", "500");

    vi.spyOn(apiModule, "fetchApi").mockImplementation((url: string, opts?: any) => {
      if (url.includes("/gamification/my-xp/")) {
        return Promise.resolve({ total_xp: 500 });
      }
      if (url.includes("/gamification/shop/purchase/")) {
        return Promise.resolve({
          success: true,
          item: "Flame Saver (Streak Freeze)",
          xp_spent: 150,
          remaining_xp: 350,
        });
      }
      return Promise.resolve([]);
    });
  });

  function renderWithQueryClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );
  }

  it("renders Flame Saver streak freeze shield item in the shop catalog", async () => {
    renderWithQueryClient(<ShopPage />);

    expect(
      await screen.findByText("Flame Saver (Streak Freeze)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Protects your daily activity streak from breaking/i),
    ).toBeInTheDocument();
  });

  it("displays shield benefit and cost correctly for Flame Saver", async () => {
    renderWithQueryClient(<ShopPage />);

    expect(await screen.findByText("1 Day Streak Shield")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("allows purchasing the streak freeze shield item when user has sufficient XP", async () => {
    renderWithQueryClient(<ShopPage />);

    expect(await screen.findByText("Flame Saver (Streak Freeze)")).toBeInTheDocument();
    const buyButton = screen.getByRole("button", { name: "Unlocks at Level 1 • Requires 150 XP" });
    expect(buyButton).toBeInTheDocument();

    fireEvent.click(buyButton);
  });

  it("filters shop catalog items by category tab", async () => {
    renderWithQueryClient(<ShopPage />);

    const streakCategoryBtn = await screen.findByText(/Streak 🛡️/i);
    fireEvent.click(streakCategoryBtn);
    expect(screen.getByText("Flame Saver (Streak Freeze)")).toBeInTheDocument();
  });

  it("displays current user XP balance accurately in header badge", async () => {
    renderWithQueryClient(<ShopPage />);

    expect(await screen.findByText(/Available XP/i)).toBeInTheDocument();
  });

  it("displays empty state when user views vault without purchases", async () => {
    renderWithQueryClient(<ShopPage />);

    const vaultTab = await screen.findByText(/My Vault/i);
    fireEvent.click(vaultTab);
    expect(screen.getByText(/Your Vault is empty/i)).toBeInTheDocument();
  });

  it("switches back from vault view to store catalog view via action button", async () => {
    renderWithQueryClient(<ShopPage />);

    const vaultTab = await screen.findByText(/My Vault/i);
    fireEvent.click(vaultTab);
    expect(screen.getByText(/Your Vault is empty/i)).toBeInTheDocument();

    const browseStoreBtn = screen.getByRole("button", { name: /Browse Store Catalog/i });
    fireEvent.click(browseStoreBtn);

    expect(screen.getByText("Flame Saver (Streak Freeze)")).toBeInTheDocument();
  });

  it("displays all categories pill and allows resetting category filter", async () => {
    renderWithQueryClient(<ShopPage />);

    const allPill = await screen.findByText(/All Items 🛍️/i);
    fireEvent.click(allPill);
    expect(screen.getByText("Flame Saver (Streak Freeze)")).toBeInTheDocument();
    expect(screen.getByText(/2x XP Multiplier Boost/i)).toBeInTheDocument();
  });
});
