import { useState, useEffect } from "react";
import type { Theme } from "./themeUtils";
import { ThemeProvider } from "./ThemeContext";

export { ThemeProvider };

const THEME_KEY = "app-theme";
const THEME_KEY = 'theme-preference';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage first
    const stored = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    
    if (stored) {
      setTheme(stored);
      document.documentElement.className = stored;
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = systemPrefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      document.documentElement.className = defaultTheme;
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.className = newTheme;
  };

  return { theme, toggleTheme, mounted };
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light" || saved === "system")
      return saved as Theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("sound-effects-enabled");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    const applied =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.className = applied;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  const toggleTheme = () => {
    setThemeState((prev: Theme) => (prev === "light" ? "dark" : "light"));
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("sound-effects-enabled", String(next));
      return next;
    });
  };

  const playAudioCue = (_type: "success" | "error" | "achievement") => {};

  return {
    theme,
    setTheme,
    toggleTheme,
    soundEnabled,
    toggleSound,
    playAudioCue,
  };
}
