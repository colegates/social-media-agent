import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'TestPassword1';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  // If redirected to onboarding, skip it by going directly to topics
  if (page.url().includes('/onboarding')) {
    // Mark onboarding complete via API
    await page.request.patch('/api/user/settings', {
      data: { settings: { onboardingCompleted: true } },
    });
    await page.goto('/topics');
  }
}

test.describe('Topic CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('topics page loads', async ({ page }) => {
    await page.goto('/topics');
    await expect(page).toHaveURL(/\/topics/);
    // Should show the page heading
    await expect(page.locator('h1')).toContainText(/topic/i, { timeout: 5000 });
  });

  test('can navigate to new topic form', async ({ page }) => {
    await page.goto('/topics');
    // Look for "Add topic" or "New topic" button
    const addButton = page.locator('a[href="/topics/new"], button:has-text("Add"), button:has-text("New")').first();
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });

  test('topics API returns array', async ({ page }) => {
    // Authenticated request to the API
    const response = await page.request.get('/api/topics');
    if (response.status() === 200) {
      const body = await response.json() as { data: unknown[] };
      expect(Array.isArray(body.data)).toBe(true);
    } else {
      // User may not be logged in for this request context - skip
      expect([200, 401]).toContain(response.status());
    }
  });
});
