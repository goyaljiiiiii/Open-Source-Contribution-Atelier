import { test, expect } from "./fixtures";
import { mockLogin } from "./helpers/auth";
import fs from "fs";

test.describe("Certificate Generation & Verification E2E Flow", () => {
  test.beforeEach(async ({ authPage }) => {
    await mockLogin(authPage);

    // Mock dashboard stats
    await authPage.route("**/api/dashboard/contributor/", async (route) => {
      const json = {
        personal_stats: {
          total_xp: 5000,
          streak_days: 10,
          rank: 1,
          prs_merged: 5,
        },
        assigned_issues: [],
        recent_prs: [],
      };
      await route.fulfill({ status: 200, json });
    });

    // Mock progress to show 100% completion
    await authPage.route("**/api/content/curriculum/", async (route) => {
      const json = {
        modules: [
          {
            slug: "module-1",
            title: "Module 1",
            description: "Test",
            lessons: ["lesson-1"],
          },
        ],
      };
      await route.fulfill({ status: 200, json });
    });

    await authPage.route("**/api/progress/me/", async (route) => {
      const json = [
        {
          lesson: "lesson-1",
          score: 100,
          completed: true,
          completed_at: new Date().toISOString(),
        },
      ];
      await route.fulfill({ status: 200, json });
    });

    // Mock the certificate generation response
    await authPage.route("**/api/progress/certificate/", async (route) => {
      const json = {
        certificate: {
          username: "testuser",
          course_name: "The Open Source Contribution Atelier",
          issued_date: new Date().toISOString(),
          verification_hash: "abcd-1234-test-hash",
        },
      };
      await route.fulfill({ status: 200, json });
    });
  });

  test("User can generate, view, and download PNG certificate", async ({
    authPage,
  }) => {
    await authPage.goto("/dashboard");

    // Ensure dashboard loads
    await expect(authPage.locator("body")).toBeVisible();
    await expect(authPage.getByText(/Completion Certificate/i)).toBeVisible();

    // Check that the download button is present (100% completion requirement fulfilled)
    const downloadModalBtn = authPage.locator(
      "button:has-text('Download Certificate')",
    );
    await expect(downloadModalBtn).toBeVisible({ timeout: 10000 });

    // Click the button to open Certificate Modal
    await downloadModalBtn.click();

    // Wait for the modal to appear
    const modalHeading = authPage.getByText("Certificate of Completion", {
      exact: true,
    });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Verify certificate details are rendered in the modal
    await expect(authPage.getByText("abcd-1234-test-hash")).toBeVisible();
    await expect(authPage.getByText(/testuser/i)).toBeVisible();

    // Verify action buttons exist in modal
    const downloadPngBtn = authPage.locator("button:has-text('Download PNG')");
    await expect(downloadPngBtn).toBeVisible();

    // Trigger PNG download and catch event
    const downloadPromise = authPage.waitForEvent("download", { timeout: 15000 });
    await downloadPngBtn.click();
    const download = await downloadPromise;

    // Verify downloaded filename and file content
    expect(download.suggestedFilename()).toContain("Certificate");
    expect(download.suggestedFilename()).toContain(".png");

    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    if (filePath) {
      const buffer = fs.readFileSync(filePath);
      expect(buffer.length).toBeGreaterThan(0);
      // Verify PNG Magic bytes: 0x89, 0x50 ('P'), 0x4E ('N'), 0x47 ('G')
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });

  test("User can verify certificate hash against backend verification endpoint", async ({
    authPage,
  }) => {
    // Mock the backend verification hash endpoint
    await authPage.route(
      "**/api/progress/verify/abcd-1234-test-hash/",
      async (route) => {
        const json = {
          is_valid: true,
          certificate: {
            verification_hash: "abcd-1234-test-hash",
            course_name: "The Open Source Contribution Atelier",
            issued_at: new Date().toISOString(),
            learner_name: "testuser",
            is_active: true,
          },
        };
        await route.fulfill({ status: 200, json });
      },
    );

    await authPage.goto("/verify/abcd-1234-test-hash");

    // Assert verification UI loads and renders verified status
    await expect(authPage.getByText("Verified Certificate")).toBeVisible({
      timeout: 10000,
    });
    await expect(authPage.getByText("Official Record")).toBeVisible();
    await expect(authPage.getByText("testuser")).toBeVisible();
    await expect(
      authPage.getByText("The Open Source Contribution Atelier"),
    ).toBeVisible();
    await expect(authPage.getByText("abcd-1234-test-hash")).toBeVisible();
  });

  test("Handles invalid or non-existent certificate hash gracefully", async ({
    authPage,
  }) => {
    // Mock 404 response for invalid hash
    await authPage.route(
      "**/api/progress/verify/invalid-hash-999/",
      async (route) => {
        await route.fulfill({
          status: 404,
          json: { error: "Certificate not found" },
        });
      },
    );

    await authPage.goto("/verify/invalid-hash-999");

    // Assert invalid certificate error state is shown
    await expect(authPage.getByText("Invalid Certificate")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      authPage.getByText(/We couldn't verify this certificate/i),
    ).toBeVisible();
  });
});
