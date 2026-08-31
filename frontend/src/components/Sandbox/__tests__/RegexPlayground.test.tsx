import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { RegexPlayground } from "../RegexPlayground";
import { formatFlags, PRESETS, CHEAT_SHEET } from "../regex/patternLibrary";
import type { RegexFlags } from "../regex/types";

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("formatFlags", () => {
  it("returns empty string when no flags active", () => {
    const flags: RegexFlags = { g: false, i: false, m: false, s: false };
    expect(formatFlags(flags)).toBe("");
  });

  it("returns only active flags", () => {
    const flags: RegexFlags = { g: true, i: false, m: true, s: false };
    expect(formatFlags(flags)).toBe("gm");
  });

  it("returns all flags when all active", () => {
    const flags: RegexFlags = { g: true, i: true, m: true, s: true };
    expect(formatFlags(flags)).toBe("gims");
  });
});

describe("PRESETS", () => {
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("each preset has required fields", () => {
    PRESETS.forEach((p) => {
      expect(p.name).toBeTruthy();
      expect(p.pattern).toBeTruthy();
      expect(p.flags).toBeTruthy();
      expect(p.testString).toBeTruthy();
    });
  });

  it("each preset produces valid regex", () => {
    PRESETS.forEach((p) => {
      expect(() => new RegExp(p.pattern, p.flags)).not.toThrow();
    });
  });
});

describe("CHEAT_SHEET", () => {
  it("has entries for all categories", () => {
    const cats = new Set(CHEAT_SHEET.map((e) => e.category));
    expect(cats.has("character")).toBe(true);
    expect(cats.has("quantifier")).toBe(true);
    expect(cats.has("anchor")).toBe(true);
    expect(cats.has("group")).toBe(true);
  });
});

describe("RegexPlayground", () => {
  it("renders the header with title", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Regex Playground")).toBeInTheDocument();
  });

  it("renders preset buttons", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Common Patterns")).toBeInTheDocument();
    expect(screen.getByText("Email Address")).toBeInTheDocument();
    expect(screen.getByText("URL (http/https)")).toBeInTheDocument();
  });

  it("renders the regex input", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Regular Expression")).toBeInTheDocument();
    expect(screen.getByText("Flags:")).toBeInTheDocument();
  });

  it("renders the test string area", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Test String")).toBeInTheDocument();
  });

  it("renders the cheat sheet", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Cheat Sheet")).toBeInTheDocument();
    expect(screen.getByText("Character Classes")).toBeInTheDocument();
  });

  it("renders the Random Preset button", () => {
    renderWithRouter(<RegexPlayground />);
    expect(screen.getByText("Random Preset")).toBeInTheDocument();
  });

  it("loads a preset and shows matches", () => {
    renderWithRouter(<RegexPlayground />);
    fireEvent.click(screen.getByText("Email Address"));
    expect(screen.getByText("matches standard email addresses", { exact: false })).toBeInTheDocument();
  });

  it("toggles flag buttons on click", () => {
    renderWithRouter(<RegexPlayground />);
    const flagI = screen.getByText("i");
    fireEvent.click(flagI);
    // The button should now have the active style (containing 'bg-primary')
    expect(flagI.className).toContain("bg-primary");
  });

  it("displays regex error for invalid pattern", () => {
    renderWithRouter(<RegexPlayground />);
    const input = screen.getByPlaceholderText("Enter regex pattern...");
    fireEvent.change(input, { target: { value: "[invalid" } });
    expect(screen.getByText(/Invalid/)).toBeInTheDocument();
  });
});
