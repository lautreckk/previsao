import { test, expect, devices } from '@playwright/test';
import { waitForPageLoad } from './helpers/test-utils';

// Must be top-level, not inside describe
test.use({ ...devices['iPhone 14'] });

test.describe('Mobile Experience', () => {
  test('home page responsiva no mobile', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test('login page responsiva no mobile', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);

    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('criar conta page responsiva', async ({ page }) => {
    await page.goto('/criar-conta');
    await waitForPageLoad(page);

    await expect(page.getByPlaceholder('Seu nome completo')).toBeVisible();
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
  });

  test('bottom nav visivel no mobile', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const nav = page.locator('nav, [class*="fixed"][class*="bottom"]');
    const count = await nav.count();
    expect(count).toBeGreaterThan(0);
  });

  test('perfil page responsiva', async ({ page }) => {
    await page.goto('/perfil');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('resultados page responsiva', async ({ page }) => {
    await page.goto('/resultados');
    await waitForPageLoad(page);

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });
});
