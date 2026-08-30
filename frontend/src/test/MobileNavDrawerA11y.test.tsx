import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "../components/layout/Navigation";
import { ThemeProvider } from "../context/ThemeContext";
import * as authContextModule from "../features/auth/AuthContext";

vi.mock("../components/ui/NotificationMenu", () => ({
  NotificationMenu: () => null,
}));

describe("Mobile Navigation Drawer A11y & Focus Trap (#2605)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.spyOn(authContextModule, "useAuth").mockReturnValue({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        is_staff: false,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkUser: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders mobile hamburger button and opens accessible dialog", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const toggleBtn = screen.getByRole("button", { name: "Open mobile menu" });
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);

    const dialog = screen.getByRole("dialog", { name: "Mobile Navigation" });
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    // Ensure dialog is NOT wrapped inside an aria-hidden container
    let parent = dialog.parentElement;
    while (parent && parent !== document.body) {
      expect(parent.getAttribute("aria-hidden")).not.toBe("true");
      parent = parent.parentElement;
    }
  });

  it("closes drawer when close button is pressed", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const toggleBtn = screen.getByRole("button", { name: "Open mobile menu" });
    fireEvent.click(toggleBtn);

    const dialog = screen.getByRole("dialog", { name: "Mobile Navigation" });
    expect(dialog).toBeDefined();

    // Close via close button in drawer
    const closeBtn = screen.getByRole("button", { name: "Close mobile menu" });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole("dialog", { name: "Mobile Navigation" }),
    ).toBeNull();
  });
});
