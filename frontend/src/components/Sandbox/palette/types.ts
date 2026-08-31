export interface PaletteColor {
  hex: string;
  hsl: { h: number; s: number; l: number };
  shades: string[];
  label: string;
}

export interface ContrastResult {
  ratio: number;
  wcagAA: boolean;
  wcagAALarge: boolean;
  wcagAAA: boolean;
  wcagAAALarge: boolean;
}

export interface PaletteConfig {
  baseHue: number;
  saturation: number;
  lightness: number;
  count: number;
  name: string;
}
