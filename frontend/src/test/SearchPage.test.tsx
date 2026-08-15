import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { SearchWithFilters } from "../components/Search/SearchWithFilters";
import { SearchPage } from "../pages/SearchPage";

// Mock useSearchWithCategories hook for SearchPage component testing
vi.mock("../hooks/useSearchWithCategories", () => ({
  useSearchWithCategories: () => ({
    results: [],
    isLoading: false,
    error: null,
    isDegraded: false,
    categories: ["Git", "GitHub", "Security"],
    search: vi.fn(),
    retry: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));

describe("SearchPage and SearchWithFilters", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("SearchPage component", () => {
    it("renders page title and subtitle", () => {
      render(
        <MemoryRouter initialEntries={["/search"]}>
          <SearchPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole("heading", { name: /Search/i })).toBeInTheDocument();
      expect(
        screen.getByText("Find lessons, modules, and resources"),
      ).toBeInTheDocument();
    });
  });

  describe("SearchWithFilters loading state", () => {
    it("renders skeleton loader when isLoading is true", () => {
      render(
        <MemoryRouter>
          <SearchWithFilters isLoading={true} />
        </MemoryRouter>,
      );

      const skeletonContainer = screen.getByLabelText("Loading search results");
      expect(skeletonContainer).toBeInTheDocument();
      expect(skeletonContainer.querySelectorAll(".result-skeleton").length).toBe(4);
      expect(screen.queryByText(/No lessons found/i)).not.toBeInTheDocument();
    });
  });

  describe("SearchWithFilters error state", () => {
    it("renders error banner with message and retry button", () => {
      const handleRetry = vi.fn();
      render(
        <MemoryRouter>
          <SearchWithFilters
            error="Search service connection timed out"
            onRetry={handleRetry}
          />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("Search service connection timed out"),
      ).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: /Try again/i });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("SearchWithFilters empty state", () => {
    it("renders friendly empty state with query text and clear search button", () => {
      render(
        <MemoryRouter initialEntries={["/search?q=nonexistentterm"]}>
          <SearchWithFilters
            results={[]}
            isLoading={false}
            categories={["Git", "GitHub"]}
          />
        </MemoryRouter>,
      );

      // Verify empty state icon and title with query string
      expect(screen.getByText("🔍")).toBeInTheDocument();
      expect(
        screen.getByText('No lessons found for "nonexistentterm"'),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your search or clearing your filters"),
      ).toBeInTheDocument();

      // Verify clear search button is rendered and functional
      const clearBtn = screen.getByRole("button", { name: /Clear search/i });
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);

      const input = screen.getByRole("textbox", { name: /Search/i }) as HTMLInputElement;
      expect(input.value).toBe("");
    });

    it("renders category-specific empty state when filter is selected", () => {
      render(
        <MemoryRouter initialEntries={["/search?category=Security"]}>
          <SearchWithFilters
            results={[]}
            isLoading={false}
            categories={["Security", "Git"]}
          />
        </MemoryRouter>,
      );

      expect(
        screen.getByText("No lessons found for category #Security"),
      ).toBeInTheDocument();
    });
  });

  describe("SearchWithFilters with matching results", () => {
    it("renders results list when results are provided", () => {
      const mockResults = [
        {
          id: "1",
          title: "Introduction to Git",
          description: "Learn version control fundamentals",
          category: "Git",
          tags: ["git", "basics"],
          url: "/lessons/git-intro",
        },
      ];

      render(
        <MemoryRouter>
          <SearchWithFilters results={mockResults} isLoading={false} />
        </MemoryRouter>,
      );

      expect(screen.getByText("1 results found")).toBeInTheDocument();
      expect(screen.getByText("Introduction to Git")).toBeInTheDocument();
      expect(
        screen.getByText("Learn version control fundamentals"),
      ).toBeInTheDocument();
    });
  });
});
