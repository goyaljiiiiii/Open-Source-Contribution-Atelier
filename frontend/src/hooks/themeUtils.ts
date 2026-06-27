export type Theme = "light" | "dark" | "system" | "high-contrast";

const THEME_KEY = "theme";

const VALID_THEMES: ReadonlySet<string> = new Set([
  "light",
  "dark",
  "system",
  "high-contrast",
]);

function isValidTheme(value: string | null): value is Theme {
  return value !== null && VALID_THEMES.has(value);
}

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage unavailable
  }
}

export function resolveTheme(theme: Theme): "light" | "dark" | "high-contrast" {
  if (theme === "system") {
    if (window.matchMedia("(prefers-contrast: more)").matches) return "high-contrast";
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }
  return theme;
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? "system";
}

export function applyThemeToDOM(theme: Theme): void {
  document.documentElement.classList.remove("dark", "high-contrast");
  const resolved = resolveTheme(theme);
  if (resolved !== "light") {
    document.documentElement.classList.add(resolved);
  }
}

export function syncThemeOnLoad(): void {
  try {
    const theme = getStoredTheme() ?? "system";
    applyThemeToDOM(theme);
  } catch {
    // localStorage unavailable
  }
}
