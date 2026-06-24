import { useState, useEffect } from "react";

export type Theme = "light" | "dark" | "high-contrast";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "high-contrast") {
      return stored;
    }
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      return "high-contrast";
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return "dark";
    }
    return "light";
  } catch {
    return "light";
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
    
    document.documentElement.classList.remove("dark", "high-contrast");
    
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (theme === "high-contrast") {
      document.documentElement.classList.add("high-contrast");
    }
  }, [theme]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark" || e.newValue === "high-contrast")) {
        setTheme(e.newValue as Theme);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => prev === "light" ? "dark" : "light");
  };

  const setSpecificTheme = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return { theme, toggleTheme, setTheme: setSpecificTheme };
}
