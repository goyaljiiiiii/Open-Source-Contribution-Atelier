import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileSettingsForm } from "./ProfileSettingsForm";
import { ToastProvider } from "../ui/ToastContext";
import { fetchApi } from "../../lib/api";

// Mock fetchApi to prevent actual network calls
vi.mock("../../lib/api", () => ({
  fetchApi: vi.fn(),
}));

beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

// Mock useAuth context values — use stable references to prevent infinite useEffect loops
const mockCheckUser = vi.fn();
const mockUser = { email: "test@example.com", username: "testuser" };
vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    checkUser: mockCheckUser,
  }),
}));

// Mock useWebPush to prevent navigator.serviceWorker issues in jsdom
vi.mock("../../hooks/useWebPush", () => ({
  useWebPush: () => ({
    isSupported: false,
    isSubscribed: false,
    permission: "default" as NotificationPermission,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}));

function submitForm() {
  const form = document.querySelector("form")!;
  fireEvent.submit(form);
}

describe("ProfileSettingsForm Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with the user's current email", () => {
    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );
    const emailInput = screen.getByLabelText(
      /Email Address/i,
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("test@example.com");
  });

  it("shows validation error for invalid email format", async () => {
    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );
    const emailInput = screen.getByLabelText(/Email Address/i);

    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address"),
      ).toBeInTheDocument();
    });

    // API should not be called
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it("shows validation error when password is less than 8 characters", async () => {
    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );
    const passwordInput = screen.getByLabelText(/New Password/i);

    fireEvent.change(passwordInput, { target: { value: "short" } });
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Password must be at least 8 characters long if provided",
        ),
      ).toBeInTheDocument();
    });

    expect(fetchApi).not.toHaveBeenCalled();
  });

  it("submits successfully with a valid email and empty password (password is optional)", async () => {
    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/New Password/i);

    fireEvent.change(emailInput, { target: { value: "new@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "" } }); // explicitly empty
    submitForm();

    await waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith("/auth/me/", {
        method: "PUT",
        requireAuth: true,
        body: expect.stringContaining('"email":"new@example.com"'),
      });
      expect(
        screen.getByText("Profile settings updated successfully!"),
      ).toBeInTheDocument();
    });
  });

  it("submits successfully with valid email and valid 8-character password", async () => {
    vi.mocked(fetchApi).mockResolvedValue(undefined);
    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/New Password/i);

    fireEvent.change(emailInput, { target: { value: "update@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "validPassword123" } });
    submitForm();

    await waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith("/auth/me/", {
        method: "PUT",
        requireAuth: true,
        body: expect.stringContaining('"email":"update@example.com"'),
      });
      expect(fetchApi).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"password":"validPassword123"'),
        }),
      );
      expect(
        screen.getAllByText("Profile settings updated successfully!").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("displays an error message when the API request fails", async () => {
    vi.mocked(fetchApi).mockRejectedValueOnce(
      new Error("Server error, could not update."),
    );

    render(
      <ToastProvider>
        <ProfileSettingsForm />
      </ToastProvider>,
    );

    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText("Server error, could not update."),
      ).toBeInTheDocument();
    });
  });
});
