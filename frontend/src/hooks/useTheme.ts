import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "system" | "high-contrast";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system" || stored === "high-contrast") {
      return stored;
    }
    // No explicit preference: default to system
    return "system";
  } catch {
    return "system";
  }
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    persistTheme(theme);
    
    const root = document.documentElement;
    root.classList.remove("dark", "high-contrast");
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "high-contrast") {
      root.classList.add("high-contrast");
    } else if (theme === "system") {
      if (window.matchMedia('(prefers-contrast: more)').matches) {
        root.classList.add("high-contrast");
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add("dark");
      }
    }
  }, [theme]);

  // Listener for system preference changes when in "system" mode
  useEffect(() => {
    const mediaQueryColor = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaQueryContrast = window.matchMedia('(prefers-contrast: more)');
    
    const handleChange = () => {
      if (theme === "system") {
        const root = document.documentElement;
        root.classList.remove("dark", "high-contrast");
        if (mediaQueryContrast.matches) {
          root.classList.add("high-contrast");
        } else if (mediaQueryColor.matches) {
          root.classList.add("dark");
        }
      }
    };

    mediaQueryColor.addEventListener('change', handleChange);
    mediaQueryContrast.addEventListener('change', handleChange);

    return () => {
      mediaQueryColor.removeEventListener('change', handleChange);
      mediaQueryContrast.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark" || e.newValue === "system" || e.newValue === "high-contrast")) {
        setTheme(e.newValue as Theme);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "system";
      return "light";
    });
  };

  const setSpecificTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return { theme, toggleTheme, setTheme: setSpecificTheme };
}
