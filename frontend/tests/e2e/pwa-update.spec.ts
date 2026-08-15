import { test, expect } from "@playwright/test";

test.describe("Service Worker Prompt-Based Update Flow", () => {
  test("displays UpdateAvailableBanner on update detection and does not auto-reload", async ({
    page,
  }) => {
    await page.goto("/");

    // Dispatch custom PWA update event simulating update detection
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("pwa-need-refresh", {
          detail: {
            updateSW: (reload?: boolean) => {
              (window as any).__pwaUpdateTriggered = reload;
            },
          },
        }),
      );
    });

    // Verify banner appears
    const banner = page.locator('[data-testid="pwa-update-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("New Version Available");

    // Verify page did not reload automatically without user interaction
    const isReloaded = await page.evaluate(
      () => (window as any).__pwaUpdateTriggered,
    );
    expect(isReloaded).toBeUndefined();

    // Click "Update Now"
    await banner.getByRole("button", { name: /Update Now/i }).click();

    // Verify update handler was triggered
    const wasUpdated = await page.evaluate(
      () => (window as any).__pwaUpdateTriggered,
    );
    expect(wasUpdated).toBe(true);
  });

  test("dismisses banner when Later is clicked", async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("pwa-need-refresh", {
          detail: { updateSW: () => {} },
        }),
      );
    });

    const banner = page.locator('[data-testid="pwa-update-banner"]');
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: /Later/i }).click();
    await expect(banner).not.toBeVisible();
  });
});
