import { describe, it, expect } from "vitest";
import { analyzeLessonMarkdown } from "../utils/lessonContentAnalyzer";

describe("Lesson Content Analyzer (AI Suggestions)", () => {
  it("calculates Flesch reading ease score and word count", () => {
    const markdown = `# Introduction to Git

Git is a distributed version control system. It records changes to files over time.
`;
    const report = analyzeLessonMarkdown(markdown);
    expect(report.wordCount).toBeGreaterThan(10);
    expect(report.readingEaseScore).toBeGreaterThan(0);
    expect(report.readingEaseScore).toBeLessThanOrEqual(100);
  });

  it("detects missing alt text on markdown images", () => {
    const markdown = `Here is an architecture image:
![](https://example.com/diagram.png)
![image](https://example.com/flow.png)
`;
    const report = analyzeLessonMarkdown(markdown);
    const missingAltSuggestions = report.suggestions.filter((s) => s.type === "missing_alt");
    expect(missingAltSuggestions.length).toBeGreaterThan(0);
  });

  it("suggests code blocks when headings lack code snippets", () => {
    const markdown = `## Git Rebase Workflow

Git rebase allows you to linearize your commit history.
`;
    const report = analyzeLessonMarkdown(markdown);
    const codeSuggestions = report.suggestions.filter((s) => s.type === "code");
    expect(codeSuggestions.length).toBeGreaterThan(0);
  });

  it("suggests internal links when curriculum keywords are mentioned", () => {
    const markdown = `In this lesson we will learn how to handle a merge conflict in Git.`;
    const report = analyzeLessonMarkdown(markdown);
    const linkSuggestions = report.suggestions.filter((s) => s.type === "internal_link");
    expect(linkSuggestions.length).toBeGreaterThan(0);
  });
});
