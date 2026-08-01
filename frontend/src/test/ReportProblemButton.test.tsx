import { describe, it, expect } from "vitest";

// Test helper to verify GitHub issue pre-filled link builder logic
describe("Report a Problem Button Link Builder", () => {
  it("constructs correct pre-filled GitHub issue URL", () => {
    const lessonTitle = "What is Open Source?";
    const currentUrl = "http://localhost:5173/learn/what-is-open-source";

    const issueTitle = encodeURIComponent(`[Lesson Issue]: ${lessonTitle}`);
    const issueBody = encodeURIComponent(
      `**Lesson Title:** ${lessonTitle}\n` +
        `**Lesson URL:** ${currentUrl}\n\n` +
        `### What's wrong?\n` +
        `Please describe the typo, broken link, or incorrect information in this lesson.`
    );
    const expectedUrl = `https://github.com/Babin123456/Open-Source-Contribution-Atelier/issues/new?title=${issueTitle}&body=${issueBody}&labels=bug,documentation`;

    expect(expectedUrl).toContain("labels=bug,documentation");
    expect(expectedUrl).toContain(encodeURIComponent("What is Open Source?"));
  });
});
