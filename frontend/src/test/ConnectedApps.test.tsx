import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedApps } from "../pages/settings/ConnectedApps";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from "../api";
import { toast } from "react-hot-toast";

describe("ConnectedApps", () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax
    vi.useRealTimers();
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id: 1,
          client_id: "github_app",
          client_name: "GitHub Integration",
          scope: "profile repo",
          access_token_expires_at: "2099-01-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          is_revoked: false,
          last_sync: null,
        },
      ],
    });
    vi.mocked(api.post).mockResolvedValue({
      data: { last_sync: "2026-08-29T00:00:00Z" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows Never synced and updates badge after Sync Now succeeds", async () => {
    render(<ConnectedApps />);

    expect(await screen.findByText("Never synced")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sync Now" }));
    });

    expect(api.post).toHaveBeenCalledWith("/oauth/user-apps/1/sync/");
    expect(toast.success).toHaveBeenCalledWith("Sync completed successfully!");
    expect(screen.getByText(/Last synced/i)).toBeInTheDocument();
  });
});
