import type { ContrastResult, PaletteColor } from "./types";

// ── Hex / HSL conversions ────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  );
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rN) h = ((gN - bN) / delta + (gN < bN ? 6 : 0)) * 60;
    else if (max === gN) h = ((bN - rN) / delta + 2) * 60;
    else h = ((rN - gN) / delta + 4) * 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// ── WCAG Contrast ────────────────────────────────────────────────────

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const l1 = luminance(c1.r, c1.g, c1.b);
  const l2 = luminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateContrast(hex1: string, hex2: string): ContrastResult {
  const ratio = contrastRatio(hex1, hex2);
  return {
    ratio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAALarge: ratio >= 3,
    wcagAAA: ratio >= 7,
    wcagAAALarge: ratio >= 4.5,
  };
}

// ── Palette Generation ───────────────────────────────────────────────

function generateShades(baseHex: string): string[] {
  const { h, s } = hexToHsl(baseHex);
  return [95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5].map((l) =>
    hslToHex(h, Math.min(100, s + (l > 50 ? -10 : 10)), l),
  );
}

const HARMONIC_OFFSETS: Record<string, number[]> = {
  complementary: [0, 180],
  analogous: [0, 30, -30],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

export type HarmonyType = keyof typeof HARMONIC_OFFSETS;

export function generatePalette(
  baseHue: number,
  saturation: number,
  lightness: number,
  count: number,
  harmony: HarmonyType = "analogous",
): PaletteColor[] {
  const offsets = HARMONIC_OFFSETS[harmony] || HARMONIC_OFFSETS.analogous;
  const colors: PaletteColor[] = [];

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + offsets[i % offsets.length] + (i >= offsets.length ? i * 15 : 0)) % 360;
    const hex = hslToHex(hue, saturation, lightness);
    colors.push({
      hex,
      hsl: { h: hue, s: saturation, l: lightness },
      shades: generateShades(hex),
      label: `color-${i + 1}`,
    });
  }

  return colors;
}

export function randomBaseHue(): number {
  return Math.floor(Math.random() * 360);
}
