import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginPage } from "../pages/LoginPage";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock("../features/auth/DemoLoginButton", () => ({
  DemoLoginButton: () => <button>Demo Login</button>,
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: () => vi.fn(),
}));

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe("LoginPage Remember Me option", () => {
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

  it("renders 'Remember me for 30 days' checkbox and allows toggling state", () => {
    render(
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    );

    const checkbox = screen.getByLabelText(/remember me for 30 days/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
