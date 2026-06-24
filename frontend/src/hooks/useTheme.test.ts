import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with light theme by default", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(false);
  });

  it("should respect localStorage preference for high-contrast", () => {
    localStorage.setItem("theme", "high-contrast");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("high-contrast");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should respect system preference for high contrast", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-contrast: more)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("high-contrast");
  });

  it("should toggle from light to dark", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should set specific theme to high-contrast", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme("high-contrast");
    });
    expect(result.current.theme).toBe("high-contrast");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("high-contrast");
  });
});
