import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdvancedSearch } from "../components/Search/AdvancedSearch";
import * as apiModule from "../lib/api";

describe("AdvancedSearch component", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders search input with initial placeholder", () => {
    render(<AdvancedSearch />);
    expect(
      screen.getByPlaceholderText(/search with natural language/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("triggers search on form submission and renders matching results", async () => {
    const mockResults = {
      count: 1,
      results: [
        {
          id: "101",
          title: "Introduction to Git Branching",
          description: "Learn how to create and merge branches safely.",
          content_type: "lesson",
          relevance_score: 0.95,
          tags: ["git", "branching"],
        },
      ],
    };

    vi.spyOn(apiModule, "fetchApi").mockResolvedValue(mockResults);

    render(<AdvancedSearch />);
    const input = screen.getByPlaceholderText(/search with natural language/i);
    const searchBtn = screen.getByRole("button", { name: /search/i });

    fireEvent.change(input, { target: { value: "branching" } });
    fireEvent.click(searchBtn);

    await waitFor(
      () => {
        expect(screen.getByText("Introduction to Git Branching")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(
      screen.getByText("Learn how to create and merge branches safely."),
    ).toBeInTheDocument();
    expect(screen.getByText("#git")).toBeInTheDocument();
    expect(screen.getByText("#branching")).toBeInTheDocument();
  });

  it("calls onResultClick when a search result card is clicked", async () => {
    const handleResultClick = vi.fn();
    const mockResults = {
      count: 1,
      results: [
        {
          id: "102",
          title: "Advanced Git Workflows",
          description: "Interactive exercises for rebase vs merge.",
          content_type: "lesson",
          relevance_score: 0.85,
        },
      ],
    };

    vi.spyOn(apiModule, "fetchApi").mockResolvedValue(mockResults);

    render(<AdvancedSearch onResultClick={handleResultClick} />);
    const input = screen.getByPlaceholderText(/search with natural language/i);
    const searchBtn = screen.getByRole("button", { name: /search/i });

    fireEvent.change(input, { target: { value: "workflows" } });
    fireEvent.click(searchBtn);

    await waitFor(
      () => {
        expect(screen.getByText("Advanced Git Workflows")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const resultTitle = screen.getByText("Advanced Git Workflows");
    fireEvent.click(resultTitle);

    expect(handleResultClick).toHaveBeenCalledTimes(1);
    expect(handleResultClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "102", title: "Advanced Git Workflows" }),
    );
  });

  it("clears query and results when clear button is clicked", async () => {
    vi.spyOn(apiModule, "fetchApi").mockResolvedValue({
      count: 1,
      results: [
        {
          id: "103",
          title: "PR Review Guide",
          description: "Guidelines for reviewing pull requests.",
        },
      ],
    });

    render(<AdvancedSearch />);
    const input = screen.getByPlaceholderText(/search with natural language/i) as HTMLInputElement;
    const searchBtn = screen.getByRole("button", { name: /search/i });

    fireEvent.change(input, { target: { value: "review" } });
    fireEvent.click(searchBtn);

    await waitFor(
      () => {
        expect(screen.getByText("PR Review Guide")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const clearButton = screen.getByRole("button", { name: "✕" });
    fireEvent.click(clearButton);

    expect(input.value).toBe("");
  });
});
