import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LessonSearchModal } from "../components/Search/LessonSearchModal";
import { CategoryFilterPills } from "../components/Search/CategoryFilterPills";
import * as useLessonSearchHook from "../hooks/useLessonSearch";

vi.mock("../hooks/useLessonSearch", () => ({
  useLessonSearch: vi.fn(),
  highlightText: (text: string) => text,
}));

describe("Search Filter Chips Preservation (#2726)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useLessonSearchHook.useLessonSearch).mockReturnValue({
      search: vi.fn().mockImplementation((_query: string) => [
        {
          slug: "git-basics",
          title: "Git Basics",
          moduleTitle: "Git",
          matchingSnippet: "Learn basic git commands",
          relevanceScore: 95,
          tags: ["git"],
        },
        {
          slug: "security-audits",
          title: "Security Audits",
          moduleTitle: "Security",
          matchingSnippet: "Audit dependencies with pip-audit",
          relevanceScore: 88,
          tags: ["security"],
        },
      ]),
      loading: false,
      catalog: [],
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("renders filter chips in LessonSearchModal and selects a category", () => {
    render(
      <MemoryRouter>
        <LessonSearchModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const gitChip = screen.getByTestId("search-filter-chip-git");
    expect(gitChip).toBeDefined();
    expect(gitChip.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(gitChip);
    expect(gitChip.getAttribute("aria-pressed")).toBe("true");
    expect(sessionStorage.getItem("lesson_search_modal_active_filter")).toBe("Git");
  });

  it("restores active filter chip from sessionStorage on remount / page refresh", () => {
    sessionStorage.setItem("lesson_search_modal_active_filter", "Security");

    render(
      <MemoryRouter>
        <LessonSearchModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const securityChip = screen.getByTestId("search-filter-chip-security");
    expect(securityChip.getAttribute("aria-pressed")).toBe("true");

    // Only security lesson is shown in results
    expect(screen.getByText("Security Audits")).toBeDefined();
    expect(screen.queryByText("Git Basics")).toBeNull();
  });

  it("preserves CategoryFilterPills selection across page reloads via sessionStorage", () => {
    sessionStorage.setItem("search_category_filter_pill", "DevOps");

    render(
      <MemoryRouter>
        <CategoryFilterPills />
      </MemoryRouter>,
    );

    const devopsPill = screen.getByRole("button", { name: /Filter by DevOps/i });
    expect(devopsPill.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("✕ Clear filter")).toBeDefined();

    // Click clear filter
    fireEvent.click(screen.getByText("✕ Clear filter"));
    expect(devopsPill.getAttribute("aria-pressed")).toBe("false");
    expect(sessionStorage.getItem("search_category_filter_pill")).toBeNull();
  });
});
