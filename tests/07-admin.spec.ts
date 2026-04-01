import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './helpers/test-utils';

test.describe('Admin Pages', () => {
  test('admin dashboard carrega', async ({ page }) => {
    await page.goto('/admin');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    // Admin page should exist even if not fully authorized
    expect(content!.length).toBeGreaterThan(50);
  });

  test('admin users page carrega', async ({ page }) => {
    await page.goto('/admin/users');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('admin markets page carrega', async ({ page }) => {
    await page.goto('/admin/markets');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('admin pix page carrega', async ({ page }) => {
    await page.goto('/admin/pix');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('admin finance page carrega', async ({ page }) => {
    await page.goto('/admin/finance');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('admin monitor page carrega', async ({ page }) => {
    await page.goto('/admin/monitor');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});
