import React, { useState, useEffect, useCallback } from "react";
import { Sun, Moon, Palette, Check } from "lucide-react";

export type ThemeMode = "light" | "dark";

export type AccentTheme = {
  id: "cyber-neon" | "coral-pop" | "electric-purple" | "emerald";
  name: string;
  color: string;
  rgb: string;
};

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    color: "#00ff66",
    rgb: "0, 255, 102",
  },
  {
    id: "coral-pop",
    name: "Coral Pop",
    color: "#ff4757",
    rgb: "255, 71, 87",
  },
  {
    id: "electric-purple",
    name: "Electric Purple",
    color: "#a855f7",
    rgb: "168, 85, 247",
  },
  {
    id: "emerald",
    name: "Emerald",
    color: "#10b981",
    rgb: "16, 185, 129",
  },
];

const STORAGE_MODE_KEY = "docs-theme-mode";
const STORAGE_ACCENT_KEY = "docs-theme-accent";

export function ThemePicker() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  const [activeAccent, setActiveAccent] = useState<AccentTheme["id"]>(() => {
    if (typeof window === "undefined") return "cyber-neon";
    const saved = localStorage.getItem(STORAGE_ACCENT_KEY) as AccentTheme["id"];
    return ACCENT_THEMES.some((t) => t.id === saved) ? saved : "cyber-neon";
  });

  const applyMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_MODE_KEY, newMode);
    const root = document.documentElement;
    if (newMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  const applyAccent = useCallback((accentId: AccentTheme["id"]) => {
    setActiveAccent(accentId);
    localStorage.setItem(STORAGE_ACCENT_KEY, accentId);
    const theme =
      ACCENT_THEMES.find((t) => t.id === accentId) || ACCENT_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty("--accent-color", theme.color);
    root.style.setProperty("--accent-rgb", theme.rgb);
    root.style.setProperty("--accent", theme.color);
  }, []);

  useEffect(() => {
    applyMode(mode);
    applyAccent(activeAccent);
  }, [mode, activeAccent, applyMode, applyAccent]);

  const toggleMode = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    applyMode(nextMode);
  };

  return (
    <div
      data-testid="theme-picker"
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 my-4 rounded-xl border-2 border-black bg-amber-50 dark:border-white dark:bg-[#181824] shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] transition-colors"
    >
      {/* Label and Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center p-2.5 rounded-lg border-2 border-black bg-accent text-black font-bold shadow-[2px_2px_0_0_#000] dark:border-white dark:shadow-[2px_2px_0_0_#fff]">
          <Palette size={20} className="stroke-[2.5]" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-gray-900 dark:text-white uppercase">
            Documentation Theme & Accent
          </h3>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Customize Light / Dark mode and Neobrutalist accent highlights
          </p>
        </div>
      </div>

      {/* Theme Mode and Color Palette Selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleMode}
          aria-label={
            mode === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
          }
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 border-black font-extrabold text-xs uppercase bg-white dark:bg-black text-gray-900 dark:text-white shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          {mode === "light" ? (
            <>
              <Moon size={16} className="text-indigo-600 stroke-[2.5]" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun size={16} className="text-amber-400 stroke-[2.5]" />
              <span>Light Mode</span>
            </>
          )}
        </button>

        {/* Accent Color Palette Swatches */}
        <div
          role="group"
          aria-label="Select accent color theme"
          className="flex items-center gap-1.5 p-1 rounded-lg border-2 border-black bg-white dark:border-white dark:bg-black shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]"
        >
          {ACCENT_THEMES.map((theme) => {
            const isSelected = activeAccent === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyAccent(theme.id)}
                aria-label={`Select ${theme.name} accent color`}
                aria-pressed={isSelected}
                title={theme.name}
                className={`relative w-7 h-7 rounded-md border-2 border-black transition-all flex items-center justify-center ${
                  isSelected
                    ? "scale-110 ring-2 ring-black dark:ring-white z-10"
                    : "hover:scale-105 opacity-85 hover:opacity-100"
                }`}
                style={{ backgroundColor: theme.color }}
              >
                {isSelected && (
                  <Check
                    size={14}
                    className="text-black font-black stroke-[3]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
