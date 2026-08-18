import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLessonSearch, highlightText } from "../hooks/useLessonSearch";

const mockCurriculum = {
  modules: [
    {
      id: "module-1",
      title: "Git Basics",
      lessons: [
        {
          slug: "git-commit-basics",
          title: "Mastering Git Commit",
          description: "Learn how to record snapshots of your working directory with git commit.",
          expected: "git commit -m 'feat: initial commit'",
          hint: "Use git commit with a message",
        },
        {
          slug: "git-rebase-flow",
          title: "Interactive Git Rebase",
          description: "Reapply commits on top of another base tip for clean commit history.",
          expected: "git rebase -i main",
          hint: "Pick and squash commits",
        },
      ],
    },
  ],
};

describe("Lesson Full-Text Search Engine", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCurriculum,
      }),
    );
  });

  it("indexes curriculum lessons and performs exact title search", async () => {
    const { result } = renderHook(() => useLessonSearch());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let searchResults;
    act(() => {
      searchResults = result.current.search("Mastering Git Commit");
    });

    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].slug).toBe("git-commit-basics");
    expect(searchResults[0].matchType).toBe("title");
    expect(searchResults[0].relevanceScore).toBe(100);
  });

  it("ranks results by relevance when searching body text or code samples", async () => {
    const { result } = renderHook(() => useLessonSearch());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let searchResults;
    act(() => {
      searchResults = result.current.search("rebase");
    });

    expect(searchResults.length).toBe(1);
    expect(searchResults[0].slug).toBe("git-rebase-flow");
    expect(searchResults[0].matchType).toBe("title");
  });

  it("highlights matching search query in snippets", () => {
    const text = "Learn how to record snapshots of your working directory with git commit.";
    const highlighted = highlightText(text, "snapshots");
    expect(highlighted).toContain("snapshots");
  });
});
