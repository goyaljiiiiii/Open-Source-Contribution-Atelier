import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { ContinueLearning, IncompleteLesson } from "../ContinueLearning";

const mockLessons: IncompleteLesson[] = [
  {
    lesson_slug: "git-basics",
    lesson_title: "Git Basics",
    summary: "Learn essential git commands",
    progress_percentage: 60,
  },
  {
    lesson_slug: "branching-merging",
    lesson_title: "Branching and Merging",
    summary: "Master git branches",
    progress_percentage: 25,
  },
];

describe("ContinueLearning Component", () => {
  it("renders nothing when no lessons in progress", () => {
    const { container } = render(
      <BrowserRouter>
        <ContinueLearning lessons={[]} />
      </BrowserRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders incomplete lessons correctly", () => {
    render(
      <BrowserRouter>
        <ContinueLearning lessons={mockLessons} />
      </BrowserRouter>
    );

    expect(screen.getByText("Continue Learning")).toBeInTheDocument();
    expect(screen.getByText("Git Basics")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Branching and Merging")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("limits rendering to top 3 lessons", () => {
    const fourLessons: IncompleteLesson[] = [
      { lesson_slug: "l1", lesson_title: "Lesson 1", progress_percentage: 60 },
      { lesson_slug: "l2", lesson_title: "Lesson 2", progress_percentage: 40 },
      { lesson_slug: "l3", lesson_title: "Lesson 3", progress_percentage: 20 },
      { lesson_slug: "l4", lesson_title: "Lesson 4", progress_percentage: 10 },
    ];

    render(
      <BrowserRouter>
        <ContinueLearning lessons={fourLessons} />
      </BrowserRouter>
    );

    expect(screen.getByText("Lesson 1")).toBeInTheDocument();
    expect(screen.getByText("Lesson 2")).toBeInTheDocument();
    expect(screen.getByText("Lesson 3")).toBeInTheDocument();
    expect(screen.queryByText("Lesson 4")).not.toBeInTheDocument();
  });
});
