import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModuleTree } from "../components/admin/ModuleTree";
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

describe("ModuleTree", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows lesson rows when modules are expanded", () => {
    render(
      <ModuleTree
        modules={mockModules}
        onSelectLesson={vi.fn()}
        onAddModule={vi.fn()}
        onAddLesson={vi.fn()}
        onDeleteModule={vi.fn()}
        onDeleteLesson={vi.fn()}
      />,
    );

    expect(screen.getByText("Intro to Git")).toBeInTheDocument();
    expect(screen.getByText("Fork and PR")).toBeInTheDocument();
  });

  it("hides lesson rows for collapsed modules via controlled state", () => {
    render(
      <ModuleTree
        modules={mockModules}
        collapsed={{ 1: true, 2: true }}
        onToggleCollapse={vi.fn()}
        onSelectLesson={vi.fn()}
        onAddModule={vi.fn()}
        onAddLesson={vi.fn()}
        onDeleteModule={vi.fn()}
        onDeleteLesson={vi.fn()}
      />,
    );

    expect(screen.queryByText("Intro to Git")).not.toBeInTheDocument();
    expect(screen.queryByText("Fork and PR")).not.toBeInTheDocument();
  });

  it("calls onToggleCollapse when a module header is clicked", () => {
    const onToggleCollapse = vi.fn();

    render(
      <ModuleTree
        modules={mockModules}
        collapsed={{}}
        onToggleCollapse={onToggleCollapse}
        onSelectLesson={vi.fn()}
        onAddModule={vi.fn()}
        onAddLesson={vi.fn()}
        onDeleteModule={vi.fn()}
        onDeleteLesson={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Git Basics/i }));
    expect(onToggleCollapse).toHaveBeenCalledWith(1);
  });
});
