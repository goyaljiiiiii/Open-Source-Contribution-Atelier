import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModuleTreePage } from "../pages/admin/ModuleTreePage";
import type {
  LessonDraftData,
  ModuleDraftData,
} from "../hooks/useContentDraft";

const mockLesson = (
  overrides: Partial<LessonDraftData> = {},
): LessonDraftData => ({
  id: 101,
  title: "Intro to Git",
  slug: "intro-to-git",
  content: "# Intro",
  difficulty: "beginner",
  tags: [],
  estimatedMinutes: 15,
  isPublished: true,
  ...overrides,
});

const mockModules: ModuleDraftData[] = [
  {
    id: 1,
    title: "Git Basics",
    slug: "git-basics",
    order: 1,
    lessons: [mockLesson()],
  },
  {
    id: 2,
    title: "Open Source Workflow",
    slug: "open-source-workflow",
    order: 2,
    lessons: [mockLesson({ id: 102, title: "Fork and PR", slug: "fork-pr" })],
  },
];

vi.mock("../hooks/useContentDraft", () => ({
  useContentDraft: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { useContentDraft } from "../hooks/useContentDraft";

describe("ModuleTreePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("expands and collapses all modules from page-level controls", () => {
    vi.mocked(useContentDraft).mockReturnValue({
      modules: mockModules,
      activeLesson: null,
      setActiveLesson: vi.fn(),
      refetchModules: vi.fn(),
      setModules: vi.fn(),
      updateActiveLesson: vi.fn(),
      isDirty: false,
      saveStatus: "idle",
      isLoading: false,
      saveDraft: vi.fn(),
    });

    render(<ModuleTreePage />);

    expect(screen.getByText("Intro to Git")).toBeInTheDocument();
    expect(screen.getByText("Fork and PR")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse All" }));
    expect(screen.queryByText("Intro to Git")).not.toBeInTheDocument();
    expect(screen.queryByText("Fork and PR")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand All" }));
    expect(screen.getByText("Intro to Git")).toBeInTheDocument();
    expect(screen.getByText("Fork and PR")).toBeInTheDocument();
  });

  it("does not render expand/collapse controls when there are no modules", () => {
    vi.mocked(useContentDraft).mockReturnValue({
      modules: [],
      activeLesson: null,
      setActiveLesson: vi.fn(),
      refetchModules: vi.fn(),
      setModules: vi.fn(),
      updateActiveLesson: vi.fn(),
      isDirty: false,
      saveStatus: "idle",
      isLoading: false,
      saveDraft: vi.fn(),
    });

    render(<ModuleTreePage />);

    expect(
      screen.queryByRole("button", { name: "Expand All" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse All" }),
    ).not.toBeInTheDocument();
  });
});
