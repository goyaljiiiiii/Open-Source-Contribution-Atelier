import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ThemePicker, ACCENT_THEMES } from "../components/docs/ThemePicker";

describe("ThemePicker Component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders theme picker title, description, mode toggle, and accent swatches", () => {
    render(<ThemePicker />);

    expect(
      screen.getByText("Documentation Theme & Accent"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Customize Light \/ Dark mode and Neobrutalist accent highlights/,
      ),
    ).toBeInTheDocument();

    const modeButton = screen.getByRole("button", {
      name: /Switch to (Dark|Light) Mode/i,
    });
    expect(modeButton).toBeInTheDocument();

    const colorGroup = screen.getByRole("group", {
      name: "Select accent color theme",
    });
    expect(colorGroup).toBeInTheDocument();

    ACCENT_THEMES.forEach((theme) => {
      expect(
        screen.getByRole("button", {
          name: `Select ${theme.name} accent color`,
        }),
      ).toBeInTheDocument();
    });
  });

  it("toggles light and dark mode dynamically and updates localStorage & root class", () => {
    render(<ThemePicker />);

    const modeButton = screen.getByRole("button", {
      name: /Switch to (Dark|Light) Mode/i,
    });

    const isInitiallyDark = document.documentElement.classList.contains("dark");

    fireEvent.click(modeButton);

    if (isInitiallyDark) {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(localStorage.getItem("docs-theme-mode")).toBe("light");
    } else {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(localStorage.getItem("docs-theme-mode")).toBe("dark");
    }
  });

  it("selects Coral Pop accent color, updates CSS root variables, and persists in localStorage", () => {
    render(<ThemePicker />);

    const coralButton = screen.getByRole("button", {
      name: "Select Coral Pop accent color",
    });

    fireEvent.click(coralButton);

    expect(coralButton).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("docs-theme-accent")).toBe("coral-pop");
    expect(
      document.documentElement.style.getPropertyValue("--accent-color"),
    ).toBe("#ff4757");
    expect(
      document.documentElement.style.getPropertyValue("--accent-rgb"),
    ).toBe("255, 71, 87");
  });

  it("selects Electric Purple accent color and updates CSS root variables", () => {
    render(<ThemePicker />);

    const purpleButton = screen.getByRole("button", {
      name: "Select Electric Purple accent color",
    });

    fireEvent.click(purpleButton);

    expect(purpleButton).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("docs-theme-accent")).toBe("electric-purple");
    expect(
      document.documentElement.style.getPropertyValue("--accent-color"),
    ).toBe("#a855f7");
  });

  it("loads initial theme mode and accent from localStorage if present", () => {
    localStorage.setItem("docs-theme-mode", "light");
    localStorage.setItem("docs-theme-accent", "emerald");

    render(<ThemePicker />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue("--accent-color"),
    ).toBe("#10b981");

    const emeraldButton = screen.getByRole("button", {
      name: "Select Emerald accent color",
    });
    expect(emeraldButton).toHaveAttribute("aria-pressed", "true");
  });
});
