// frontend/e2e/offline-sync.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Offline-First Background Sync', () => {
  test('queues lesson completion offline and shows sync banner', async ({ page, context }) => {
    await page.goto('/');

    // Ensure initial online state
    const banner = page.locator('[data-testid="offline-sync-banner"]');
    await expect(banner).toBeHidden();

    // Go offline
    await context.setOffline(true);

    // Simulate lesson completion / progress event fetch call
    await page.evaluate(async () => {
      await fetch('/api/progress/me/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'test-req-id-12345'
        },
        body: JSON.stringify({ lesson_slug: 'intro-to-python', score: 100, completed: true })
      });
    });

    // Verify OfflineSyncBanner shows 1 pending event
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('1 unsynced progress events');

    // Go online to trigger background replay
    await context.setOffline(false);

    // Replay queue triggered on reconnection
    await expect(banner).toBeHidden({ timeout: 5000 });
  });
});
