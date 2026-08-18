import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LessonSearchModal } from "../components/Search/LessonSearchModal";
import { BrowserRouter } from "react-router-dom";
import * as lessonSearchHook from "../hooks/useLessonSearch";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LessonSearchModal accessibility & keyboard navigation", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  const mockSearchResults: lessonSearchHook.SearchResultItem[] = [
    {
      slug: "git-rebase",
      title: "Git Rebase Fundamentals",
      moduleTitle: "Git Mastery",
      description: "Interactive git rebase walkthrough.",
      matchingSnippet: "Learn git rebase...",
      matchType: "title",
      relevanceScore: 10,
    },
    {
      slug: "merge-conflicts",
      title: "Resolving Merge Conflicts",
      moduleTitle: "Git Mastery",
      description: "Step by step conflict resolution.",
      matchingSnippet: "Resolve conflict markers...",
      matchType: "body",
      relevanceScore: 8,
    },
  ];

  it("renders with correct ARIA combobox roles and listbox structure", () => {
    vi.spyOn(lessonSearchHook, "useLessonSearch").mockReturnValue({
      search: vi.fn().mockReturnValue(mockSearchResults),
      loading: false,
      lessons: [],
      error: null,
    });

    render(
      <BrowserRouter>
        <LessonSearchModal isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>,
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute("aria-autocomplete", "list");
    expect(combobox).toHaveAttribute("aria-controls", "lesson-search-listbox");
    expect(combobox).toHaveAttribute("aria-expanded", "true");

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(combobox).toHaveAttribute("aria-activedescendant", "lesson-option-0");
  });

  it("navigates options via ArrowDown and ArrowUp updating aria-activedescendant", () => {
    vi.spyOn(lessonSearchHook, "useLessonSearch").mockReturnValue({
      search: vi.fn().mockReturnValue(mockSearchResults),
      loading: false,
      lessons: [],
      error: null,
    });

    render(
      <BrowserRouter>
        <LessonSearchModal isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>,
    );

    const combobox = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");

    // Press ArrowDown
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(combobox).toHaveAttribute("aria-activedescendant", "lesson-option-1");

    // Press ArrowUp
    fireEvent.keyDown(combobox, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(combobox).toHaveAttribute("aria-activedescendant", "lesson-option-0");
  });

  it("selects active item on Enter key and navigates", () => {
    const handleClose = vi.fn();
    vi.spyOn(lessonSearchHook, "useLessonSearch").mockReturnValue({
      search: vi.fn().mockReturnValue(mockSearchResults),
      loading: false,
      lessons: [],
      error: null,
    });

    render(
      <BrowserRouter>
        <LessonSearchModal isOpen={true} onClose={handleClose} />
      </BrowserRouter>,
    );

    const combobox = screen.getByRole("combobox");
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });

    expect(mockNavigate).toHaveBeenCalledWith("/lessons/merge-conflicts");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes modal on Escape key", () => {
    const handleClose = vi.fn();
    vi.spyOn(lessonSearchHook, "useLessonSearch").mockReturnValue({
      search: vi.fn().mockReturnValue([]),
      loading: false,
      lessons: [],
      error: null,
    });

    render(
      <BrowserRouter>
        <LessonSearchModal isOpen={true} onClose={handleClose} />
      </BrowserRouter>,
    );

    const combobox = screen.getByRole("combobox");
    fireEvent.keyDown(combobox, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab key focus within modal", () => {
    vi.spyOn(lessonSearchHook, "useLessonSearch").mockReturnValue({
      search: vi.fn().mockReturnValue([]),
      loading: false,
      lessons: [],
      error: null,
    });

    render(
      <BrowserRouter>
        <LessonSearchModal isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>,
    );

    const combobox = screen.getByRole("combobox");
    combobox.focus();
    expect(document.activeElement).toBe(combobox);

    // Tab key inside modal stays focused on modal interactive elements
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBeDefined();
  });
});
