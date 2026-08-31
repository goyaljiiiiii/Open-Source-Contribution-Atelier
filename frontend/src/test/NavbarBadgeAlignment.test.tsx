import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "../components/layout/Navigation";
import * as authContext from "../features/auth/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../components/Search/LessonSearchModal", () => ({
  LessonSearchModal: () => <div data-testid="mock-search-modal" />,
}));

vi.mock("../features/notifications/NotificationContext", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    isWsConnected: true,
    isPollingFallback: false,
  }),
}));

const renderWithThemeAndRouter = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
};

describe("Navbar User Badge Count Pill Alignment", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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
  });

  afterEach(() => {
    cleanup();
  });

  it("renders user badge count pill with centered alignment classes", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        is_staff: false,
        badge_count: 5,
      } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkUser: vi.fn(),
    });

    renderWithThemeAndRouter(<Navigation />);

    const badge = screen.getByTestId("navbar-user-badge-count");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("5");
    expect(badge.className).toContain("inline-flex");
    expect(badge.className).toContain("items-center");
    expect(badge.className).toContain("justify-center");
    expect(badge.className).toContain("leading-none");
  });

  it("caps large badge counts at 99+", () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      user: {
        id: 2,
        username: "poweruser",
        email: "power@example.com",
        is_staff: true,
        badge_count: 150,
      } as any,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkUser: vi.fn(),
    });

    renderWithThemeAndRouter(<Navigation />);

    const badge = screen.getByTestId("navbar-user-badge-count");
    expect(badge.textContent).toBe("99+");

    const adminTag = screen.getByText("ADMIN");
    expect(adminTag.className).toContain("inline-flex");
    expect(adminTag.className).toContain("items-center");
    expect(adminTag.className).toContain("leading-none");
  });
});
