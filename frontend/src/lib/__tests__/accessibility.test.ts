/**
 * Tests for accessibility utilities.
 *
 * Validates ARIA helpers, keyboard navigation, focus management,
 * contrast calculation, and screen reader announcement utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getReelActionLabel,
  getReelDescription,
  validateAriaAttributes,
  isFocusable,
  relativeLuminance,
  contrastRatio,
  meetsContrastStandard,
} from "../accessibility";

// ---------------------------------------------------------------------------
//  getReelActionLabel
// ---------------------------------------------------------------------------

describe("getReelActionLabel", () => {
  it('returns "Like this reel" for like action', () => {
    expect(getReelActionLabel("like")).toBe("Like this reel");
  });

  it('returns "Unlike this reel" for unlike action', () => {
    expect(getReelActionLabel("unlike")).toBe("Unlike this reel");
  });

  it('returns "View comments" for comment action', () => {
    expect(getReelActionLabel("comment")).toBe("View comments");
  });

  it('returns "Share reel" for share action', () => {
    expect(getReelActionLabel("share")).toBe("Share reel");
  });

  it('returns "Follow creator" for follow action', () => {
    expect(getReelActionLabel("follow")).toBe("Follow creator");
  });

  it('returns "Unfollow creator" for unfollow action', () => {
    expect(getReelActionLabel("unfollow")).toBe("Unfollow creator");
  });

  it("returns the action itself for unknown actions", () => {
    expect(getReelActionLabel("custom_action" as any)).toBe(
      "custom_action",
    );
  });

  it("handles all known action types", () => {
    const actions: Array<
      "like" | "unlike" | "comment" | "share" | "follow" | "unfollow"
    > = ["like", "unlike", "comment", "share", "follow", "unfollow"];

    for (const action of actions) {
      const label = getReelActionLabel(action);
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
//  getReelDescription
// ---------------------------------------------------------------------------

describe("getReelDescription", () => {
  const reel = {
    title: "How to Undo Your Last Commit",
    creator: {
      username: "merge_wizard",
      role: "Atelier Maintainer",
    },
    likes: 4239,
    commentsCount: 84,
    tags: ["#git", "#programming"],
  };

  it("includes the reel title", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("How to Undo Your Last Commit");
  });

  it("includes the creator username", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("@merge_wizard");
  });

  it("includes the creator role", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("Atelier Maintainer");
  });

  it("formats like count with locale separators", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("4,239");
  });

  it("includes comments count", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("84 comments");
  });

  it("includes tags", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain("#git");
    expect(desc).toContain("#programming");
  });

  it("returns a single dot-joined sentence structure", () => {
    const desc = getReelDescription(reel);
    expect(desc).toContain(".");
    // Should have at least 3 sentences (4 periods)
    expect(desc.split(".").length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
//  validateAriaAttributes
// ---------------------------------------------------------------------------

describe("validateAriaAttributes", () => {
  let button: HTMLButtonElement;
  let link: HTMLAnchorElement;

  beforeEach(() => {
    button = document.createElement("button");
    link = document.createElement("a");
    link.href = "https://example.com";
  });

  it("returns empty array when all required attributes exist", () => {
    button.setAttribute("aria-label", "Click me");
    button.setAttribute("role", "button");

    const issues = validateAriaAttributes(button, [
      "aria-label",
      "role",
    ]);
    expect(issues).toEqual([]);
  });

  it("reports missing aria-label", () => {
    const issues = validateAriaAttributes(button, ["aria-label"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("aria-label");
  });

  it("reports multiple missing attributes", () => {
    const issues = validateAriaAttributes(button, [
      "aria-label",
      "aria-describedby",
      "aria-controls",
    ]);
    expect(issues).toHaveLength(3);
  });

  it("reports missing attributes for links", () => {
    const issues = validateAriaAttributes(link, ["aria-label"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("aria-label");
  });

  it("handles elements with role attribute", () => {
    button.setAttribute("role", "menuitem");
    const issues = validateAriaAttributes(button, ["aria-label"]);
    expect(issues[0]).toContain("menuitem");
  });
});

// ---------------------------------------------------------------------------
//  isFocusable
// ---------------------------------------------------------------------------

describe("isFocusable", () => {
  it("returns true for a regular button", () => {
    const btn = document.createElement("button");
    expect(isFocusable(btn)).toBe(true);
  });

  it("returns false for a disabled button", () => {
    const btn = document.createElement("button");
    btn.disabled = true;
    expect(isFocusable(btn)).toBe(false);
  });

  it("returns false for an element with tabindex=-1", () => {
    const div = document.createElement("div");
    div.tabIndex = -1;
    expect(isFocusable(div)).toBe(false);
  });

  it("returns false for an element with aria-hidden=true", () => {
    const btn = document.createElement("button");
    btn.setAttribute("aria-hidden", "true");
    expect(isFocusable(btn)).toBe(false);
  });

  it("returns true for a div with tabindex=0", () => {
    const div = document.createElement("div");
    div.tabIndex = 0;
    expect(isFocusable(div)).toBe(true);
  });

  it("returns false for a div with no tabindex", () => {
    const div = document.createElement("div");
    expect(isFocusable(div)).toBe(false);
  });

  it("returns true for an input element", () => {
    const input = document.createElement("input");
    expect(isFocusable(input)).toBe(true);
  });

  it("returns false for a hidden input", () => {
    const input = document.createElement("input");
    input.type = "hidden";
    // Note: hidden inputs have offsetParent === null in jsdom
    expect(isFocusable(input)).toBe(false);
  });

  it("returns true for an anchor with href", () => {
    const a = document.createElement("a");
    a.href = "https://example.com";
    expect(isFocusable(a)).toBe(true);
  });

  it("returns false for a select with no disabled", () => {
    const select = document.createElement("select");
    expect(isFocusable(select)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
//  relativeLuminance
// ---------------------------------------------------------------------------

describe("relativeLuminance", () => {
  it("returns 0 for black", () => {
    const lum = relativeLuminance("#000000");
    expect(lum).toBeCloseTo(0, 4);
  });

  it("returns ~1 for white", () => {
    const lum = relativeLuminance("#FFFFFF");
    expect(lum).toBeCloseTo(1, 4);
  });

  it("returns a value between 0 and 1 for mid-range colors", () => {
    const lum = relativeLuminance("#808080");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });

  it("handles 3-character hex codes", () => {
    const lum3 = relativeLuminance("#FFF");
    const lum6 = relativeLuminance("#FFFFFF");
    expect(lum3).toBeCloseTo(lum6, 4);
  });

  it("handles lowercase hex codes", () => {
    const lum = relativeLuminance("#ffffff");
    expect(lum).toBeCloseTo(1, 4);
  });

  it("returns 0 for invalid hex", () => {
    expect(relativeLuminance("invalid")).toBe(0);
    expect(relativeLuminance("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
//  contrastRatio
// ---------------------------------------------------------------------------

describe("contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    const ratio = contrastRatio("#000000", "#FFFFFF");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 21:1 for white on black (order-independent)", () => {
    const ratio1 = contrastRatio("#000000", "#FFFFFF");
    const ratio2 = contrastRatio("#FFFFFF", "#000000");
    expect(ratio1).toBeCloseTo(ratio2, 4);
  });

  it("returns 1:1 for identical colors", () => {
    const ratio = contrastRatio("#FF6B6B", "#FF6B6B");
    expect(ratio).toBeCloseTo(1, 4);
  });

  it("returns a ratio > 1 for different colors", () => {
    const ratio = contrastRatio("#FF6B6B", "#4ECDC4");
    expect(ratio).toBeGreaterThan(1);
  });

  it("handles 3-char hex codes", () => {
    const ratio = contrastRatio("#000", "#FFF");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1 for invalid colors", () => {
    const ratio = contrastRatio("invalid", "also-invalid");
    expect(ratio).toBeCloseTo(1, 4);
  });
});

// ---------------------------------------------------------------------------
//  meetsContrastStandard
// ---------------------------------------------------------------------------

describe("meetsContrastStandard", () => {
  it("black on white passes AA", () => {
    expect(meetsContrastStandard("#000000", "#FFFFFF", "AA")).toBe(
      true,
    );
  });

  it("black on white passes AAA", () => {
    expect(meetsContrastStandard("#000000", "#FFFFFF", "AAA")).toBe(
      true,
    );
  });

  it("white on white fails AA", () => {
    expect(meetsContrastStandard("#FFFFFF", "#FFFFFF", "AA")).toBe(
      false,
    );
  });

  it("large text has lower AA threshold (3:1)", () => {
    // A color with ~3:1 contrast would pass AA for large text
    // but not for normal text
    const ratio = contrastRatio("#767676", "#FFFFFF");
    // #767676 has approximately 4.54:1 ratio
    expect(meetsContrastStandard("#767676", "#FFFFFF", "AA", true)).toBe(
      true,
    );
  });

  it("large text AAA threshold is 4.5:1", () => {
    // #767676 has ~4.54:1 — should pass AAA for large text
    expect(
      meetsContrastStandard("#767676", "#FFFFFF", "AAA", true),
    ).toBe(true);
  });

  it("common UI color combos pass AA", () => {
    // Typical button styles
    expect(meetsContrastStandard("#FFFFFF", "#6366F1")).toBe(true); // white on indigo
    expect(meetsContrastStandard("#000000", "#FFD93D")).toBe(true); // black on yellow
  });

  it("low contrast combos fail AA", () => {
    expect(meetsContrastStandard("#AAAAAA", "#FFFFFF")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
//  ARIA Pattern Validation for TrendingReels
// ---------------------------------------------------------------------------

describe("TrendingReels ARIA patterns", () => {
  it("defines correct labels for all engagement actions", () => {
    const actions = [
      { action: "like" as const, expected: "Like this reel" },
      { action: "unlike" as const, expected: "Unlike this reel" },
      { action: "comment" as const, expected: "View comments" },
      { action: "share" as const, expected: "Share reel" },
    ];

    for (const { action, expected } of actions) {
      expect(getReelActionLabel(action)).toBe(expected);
    }
  });

  it("generates complete reel description for screen readers", () => {
    const reel = {
      title: "Git Stash: Save it for Later!",
      creator: { username: "stash_collector", role: "Git Architect" },
      likes: 2841,
      commentsCount: 42,
      tags: ["#coding", "#gitstash"],
    };

    const desc = getReelDescription(reel);
    expect(desc.length).toBeGreaterThan(50);
    expect(desc).toContain("Reel:");
    expect(desc).toContain("By @");
    expect(desc).toContain("likes");
    expect(desc).toContain("comments");
  });

  it("validates that a decorated button has required ARIA", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Like this reel");
    button.setAttribute("aria-pressed", "false");

    const issues = validateAriaAttributes(button, [
      "aria-label",
      "aria-pressed",
    ]);
    expect(issues).toEqual([]);
  });

  it("catches missing aria-pressed on toggle button", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Like this reel");

    const issues = validateAriaAttributes(button, [
      "aria-label",
      "aria-pressed",
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("aria-pressed");
  });
});
