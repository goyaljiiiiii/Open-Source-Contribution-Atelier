import { describe, expect, it, vi } from "vitest";
import {
  createBadgeShareCardCanvas,
  downloadBadgeShareCardImage,
  formatShareDate,
  getBadgeShareCardDataUrl,
} from "../lib/badgeShareCard";

describe("badgeShareCard Canvas utility", () => {
  it("formats dates correctly", () => {
    const formatted = formatShareDate("2026-08-24T10:00:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Aug");
  });

  it("creates a 1200x630 HTML5 Canvas element", () => {
    const canvas = createBadgeShareCardCanvas({
      badgeName: "Bug Hunter",
      badgeIcon: "🐛",
      description: "Awarded for filing 3 verified issue reports.",
      username: "alex",
      date: "2026-08-24",
    });

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
  });

  it("exports a valid PNG Data URL", () => {
    const dataUrl = getBadgeShareCardDataUrl({
      badgeName: "Git Master",
      badgeIcon: "🐙",
      username: "octocat",
    });

    expect(typeof dataUrl).toBe("string");
    expect(dataUrl.startsWith("data:image/png")).toBe(true);
  });

  it("triggers image download via anchor click", () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    downloadBadgeShareCardImage(
      {
        badgeName: "Bug Hunter",
        username: "tester",
      },
      "custom-bug-hunter.png",
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
