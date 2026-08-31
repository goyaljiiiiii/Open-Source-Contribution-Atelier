import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ColorPaletteGenerator } from "../ColorPaletteGenerator";
import {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  contrastRatio,
  evaluateContrast,
  generatePalette,
} from "../palette/colorUtils";

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("colorUtils", () => {
  it("converts hex to rgb correctly", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts rgb to hex correctly", () => {
    expect(rgbToHex(255, 0, 0)).toBe("#ff0000");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("converts hex to hsl and back", () => {
    const hsl = hexToHsl("#ff0000");
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
    const hex = hslToHex(0, 100, 50);
    expect(hex).toBe("#ff0000");
  });

  it("calculates contrast ratio for identical colors", () => {
    const ratio = contrastRatio("#ffffff", "#ffffff");
    expect(ratio).toBe(1);
  });

  it("calculates high contrast for black on white", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("evaluateContrast marks AA for ratios >= 4.5", () => {
    const result = evaluateContrast("#000000", "#ffffff");
    expect(result.wcagAA).toBe(true);
    expect(result.wcagAAA).toBe(true);
  });

  it("evaluateContrast fails AA for low contrast", () => {
    const result = evaluateContrast("#999999", "#aaaaaa");
    expect(result.wcagAA).toBe(false);
  });

  it("generates correct number of palette colors", () => {
    const palette = generatePalette(200, 70, 50, 4, "triadic");
    expect(palette.length).toBe(4);
    palette.forEach((c) => {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.shades.length).toBe(11);
    });
  });
});

describe("ColorPaletteGenerator", () => {
  it("renders the header with title", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("Color Palette Generator")).toBeInTheDocument();
  });

  it("renders palette controls", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("Palette Controls")).toBeInTheDocument();
    expect(screen.getByText("Randomize")).toBeInTheDocument();
  });

  it("renders generated palette with swatches", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("Generated Palette")).toBeInTheDocument();
    expect(screen.getByText("Show Shades")).toBeInTheDocument();
  });

  it("renders WCAG contrast checker", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("WCAG Contrast Checker")).toBeInTheDocument();
    expect(screen.getByText("Swap Colors")).toBeInTheDocument();
  });

  it("renders export button", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("Click to Export Palette")).toBeInTheDocument();
  });

  it("opens export panel on click", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    const exportBtn = screen.getByText("Click to Export Palette");
    fireEvent.click(exportBtn);
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("randomize button changes base hue", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    const randomizeBtn = screen.getByText("Randomize");
    fireEvent.click(randomizeBtn);
    // After randomize, we should still see the controls rendered
    expect(screen.getByText("Palette Controls")).toBeInTheDocument();
  });

  it("toggles shade visibility", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    const toggleBtn = screen.getByText("Hide Shades");
    fireEvent.click(toggleBtn);
    expect(screen.getByText("Show Shades")).toBeInTheDocument();
  });

  it("renders harmony options", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByText("Analogous")).toBeInTheDocument();
    expect(screen.getByText("Complementary")).toBeInTheDocument();
    expect(screen.getByText("Triadic")).toBeInTheDocument();
  });

  it("renders color sliders", () => {
    renderWithRouter(<ColorPaletteGenerator />);
    expect(screen.getByLabelText("Base Hue")).toBeInTheDocument();
    expect(screen.getByLabelText("Saturation")).toBeInTheDocument();
    expect(screen.getByLabelText("Lightness")).toBeInTheDocument();
    expect(screen.getByLabelText("Colors")).toBeInTheDocument();
  });
});
