import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import BackupDashboardPage from "../pages/admin/BackupDashboardPage";
import * as api from "../lib/api";
import toast from "react-hot-toast";

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

vi.mock("react-hot-toast", () => {
  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
  };
  return {
    default: toastMock,
    toast: toastMock,
  };
});

const mockBackups = [
  {
    id: 101,
    backup_timestamp: "2026-08-27T10:00:00Z",
    verification_timestamp: "2026-08-27T10:15:00Z",
    size_bytes: 52428800, // 50 MB
    status: "success",
    logs: "Backup integrity verified OK.",
  },
  {
    id: 100,
    backup_timestamp: "2026-08-26T10:00:00Z",
    verification_timestamp: "2026-08-26T10:15:00Z",
    size_bytes: 51380224,
    status: "success",
    logs: "Backup integrity verified OK.",
  },
];

describe("BackupDashboardPage Restoration Confirmation Modal", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.spyOn(api, "fetchApi").mockImplementation(async (url: string) => {
      if (url === "/api/monitoring/backups/") {
        return mockBackups;
      }
      return { status: "success" };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders backup dashboard and displays Restore Database Backup button", async () => {
    render(<BackupDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Backup Monitoring")).toBeDefined();
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore Database Backup/i });
    expect(restoreBtn).toBeDefined();
    expect(screen.queryByText("Confirm Database Backup Restoration")).toBeNull();
  });

  it("opens confirmation modal upon clicking Restore Database Backup", async () => {
    render(<BackupDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Backup Monitoring")).toBeDefined();
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore Database Backup/i });
    fireEvent.click(restoreBtn);

    expect(screen.getByText("Confirm Database Backup Restoration")).toBeDefined();
    expect(
      screen.getByText(/Restoring backup snapshot #101/i),
    ).toBeDefined();
  });

  it("cancels restoration and closes modal when Cancel is clicked", async () => {
    render(<BackupDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Backup Monitoring")).toBeDefined();
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore Database Backup/i });
    fireEvent.click(restoreBtn);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText("Confirm Database Backup Restoration")).toBeNull();
    expect(api.fetchApi).not.toHaveBeenCalledWith(
      "/api/monitoring/backups/101/restore/",
      expect.anything(),
    );
  });

  it("executes restore API and shows success toast when confirmed", async () => {
    render(<BackupDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Backup Monitoring")).toBeDefined();
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore Database Backup/i });
    fireEvent.click(restoreBtn);

    const confirmBtn = screen.getByRole("button", { name: "Restore Database" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.fetchApi).toHaveBeenCalledWith("/api/monitoring/backups/101/restore/", {
        method: "POST",
      });
      expect(toast.success).toHaveBeenCalledWith("Database restoration started successfully.");
    });
  });

  it("handles restore API failure gracefully with error toast", async () => {
    vi.spyOn(api, "fetchApi").mockImplementation(async (url: string) => {
      if (url === "/api/monitoring/backups/") {
        return mockBackups;
      }
      throw new Error("Server restore failure");
    });

    render(<BackupDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Backup Monitoring")).toBeDefined();
    });

    const restoreBtn = screen.getByRole("button", { name: /Restore Database Backup/i });
    fireEvent.click(restoreBtn);

    const confirmBtn = screen.getByRole("button", { name: "Restore Database" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to trigger database restoration");
    });
  });
});
