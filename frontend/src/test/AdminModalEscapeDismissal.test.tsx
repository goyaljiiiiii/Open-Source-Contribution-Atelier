import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { AuditLogViewerPage } from "../pages/admin/AuditLogViewerPage";
import CeleryDashboardPage from "../pages/admin/CeleryDashboardPage";
import { OAuthClients } from "../pages/admin/OAuthClients";
import BackupDashboardPage from "../pages/admin/BackupDashboardPage";
import * as authContextModule from "../features/auth/AuthContext";
import * as apiModule from "../lib/api";

describe("Admin Pages Modal Escape Key Dismissal Suite (#2813)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    vi.spyOn(authContextModule, "useAuth").mockReturnValue({
      user: { id: 1, username: "admin", email: "admin@example.com", is_staff: true },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkUser: vi.fn().mockResolvedValue(undefined),
    });

    vi.spyOn(apiModule, "fetchApi").mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/admin/audit/")) {
        return {
          results: [
            {
              id: 1,
              action: "created",
              resource_type: "lesson",
              resource_id: "intro-git",
              actor_username: "admin",
              created_at: "2026-08-25T10:00:00Z",
              summary: "Created lesson Intro to Git",
              before: null,
              after: { title: "Intro to Git" },
            },
          ],
          count: 1,
        };
      }
      if (endpoint.includes("celery-task-stats")) {
        return { total: 10, succeeded: 8, failed: 2 };
      }
      if (endpoint.includes("celery-task-runs")) {
        return {
          results: [
            {
              id: 1,
              task_id: "task-123",
              task_name: "tasks.send_welcome_email",
              status: "SUCCESS",
              date_done: "2026-08-25T10:00:00Z",
              result: '{"sent": true}',
            },
          ],
        };
      }
      if (endpoint.includes("celery")) {
        return { workers: [], queues: [] };
      }
      if (endpoint.includes("/api/oauth/clients/")) {
        return [
          {
            id: 1,
            name: "Test App",
            clientId: "test-client-id",
            clientSecret: "test-secret",
            clientType: "public",
            redirectUris: ["http://localhost:3000/callback"],
            allowedScopes: ["openid", "profile"],
            isActive: true,
            createdAt: "2026-08-25T10:00:00Z",
          },
        ];
      }
      if (endpoint.includes("/api/monitoring/backups/")) {
        return [
          {
            id: 1,
            backup_timestamp: "2026-08-25T10:00:00Z",
            verification_timestamp: "2026-08-25T10:05:00Z",
            size_bytes: 10485760,
            status: "failed",
            logs: "Checksum mismatch error in table public.accounts_user",
          },
        ];
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("dismisses selected event modal in AuditLogViewerPage on Escape keydown", async () => {
    render(<AuditLogViewerPage />);

    const row = await screen.findByText("Created lesson Intro to Git");
    expect(row).toBeInTheDocument();

    fireEvent.click(row);
    expect(await screen.findByText("Audit Event Record Details")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByText("Audit Event Record Details")).not.toBeInTheDocument();
  });

  it("dismisses task run details modal in CeleryDashboardPage on Escape keydown", async () => {
    render(<CeleryDashboardPage />);

    const taskRow = await screen.findByText("tasks.send_welcome_email");
    expect(taskRow).toBeInTheDocument();

    fireEvent.click(taskRow);
    expect(await screen.findByText("ID: task-123")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByText("ID: task-123")).not.toBeInTheDocument();
  });

  it("dismisses client creation modal in OAuthClients on Escape keydown", async () => {
    render(<OAuthClients />);

    const newAppBtn = await screen.findByRole("button", { name: /Register Application/i });
    fireEvent.click(newAppBtn);

    expect(screen.getByRole("heading", { name: /Register OAuth Application/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("heading", { name: /Register OAuth Application/i })).not.toBeInTheDocument();
  });

  it("dismisses auth URL tester modal in OAuthClients on Escape keydown", async () => {
    render(<OAuthClients />);

    const testBtn = await screen.findByRole("button", { name: /Test Auth Flow/i });
    fireEvent.click(testBtn);

    expect(screen.getByText("OAuth 2.0 PKCE Auth URL Tester")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByText("OAuth 2.0 PKCE Auth URL Tester")).not.toBeInTheDocument();
  });

  it("dismisses backup verification inspection modal in BackupDashboardPage on Escape keydown", async () => {
    render(<BackupDashboardPage />);

    const inspectBtn = await screen.findByRole("button", { name: /Inspect Logs/i });
    fireEvent.click(inspectBtn);

    expect(screen.getByText("Backup Verification Inspection")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByText("Backup Verification Inspection")).not.toBeInTheDocument();
  });

  it("cleans up keydown event listener on unmount without throwing errors", () => {
    const { unmount } = render(<AuditLogViewerPage />);
    expect(() => unmount()).not.toThrow();
  });

  it("ignores other keydown presses and keeps modal open", async () => {
    render(<AuditLogViewerPage />);

    const row = await screen.findByText("Created lesson Intro to Git");
    fireEvent.click(row);
    expect(await screen.findByText("Audit Event Record Details")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    expect(screen.getByText("Audit Event Record Details")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(screen.getByText("Audit Event Record Details")).toBeInTheDocument();
  });

  it("allows dismissing modal via explicit close button click", async () => {
    render(<OAuthClients />);

    const newAppBtn = await screen.findByRole("button", { name: /Register Application/i });
    fireEvent.click(newAppBtn);

    expect(screen.getByRole("heading", { name: /Register OAuth Application/i })).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: /Register OAuth Application/i })).not.toBeInTheDocument();
  });

  it("handles repeated open and Escape dismiss sequences smoothly", async () => {
    render(<OAuthClients />);

    const newAppBtn = await screen.findByRole("button", { name: /Register Application/i });

    // Open and close 1st time
    fireEvent.click(newAppBtn);
    expect(screen.getByRole("heading", { name: /Register OAuth Application/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("heading", { name: /Register OAuth Application/i })).not.toBeInTheDocument();

    // Open and close 2nd time
    fireEvent.click(newAppBtn);
    expect(screen.getByRole("heading", { name: /Register OAuth Application/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("heading", { name: /Register OAuth Application/i })).not.toBeInTheDocument();
  });

  it("verifies close button in BackupDashboardPage inspection modal functions properly", async () => {
    render(<BackupDashboardPage />);

    const inspectBtn = await screen.findByRole("button", { name: /Inspect Logs/i });
    fireEvent.click(inspectBtn);
    expect(screen.getByText("Backup Verification Inspection")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Backup Verification Inspection")).not.toBeInTheDocument();
  });
});
