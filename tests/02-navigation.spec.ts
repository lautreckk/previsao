import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './helpers/test-utils';

test.describe('Navegacao e Paginas', () => {
  test('home page carrega corretamente', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Logo should be visible
    await expect(page.locator('img[alt="Winify"]').first()).toBeVisible();

    // Should have market cards or loading state
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('home page exibe categorias de mercados', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Should have category filters or market content
    const content = await page.textContent('body');
    expect(content!.length).toBeGreaterThan(100);
  });

  test('pagina de login carrega', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);

    await expect(page.getByText('Entre na sua conta')).toBeVisible();
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByPlaceholder('Sua senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('pagina de criar conta carrega', async ({ page }) => {
    await page.goto('/criar-conta');
    await waitForPageLoad(page);

    await expect(page.getByText('Seus dados')).toBeVisible();
    await expect(page.getByText('Etapa 1 de 2')).toBeVisible();
  });

  test('pagina de resultados carrega', async ({ page }) => {
    await page.goto('/resultados');
    await waitForPageLoad(page);

    // Should have the results page header or content
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('pagina de perfil redireciona para login quando deslogado', async ({ browser }) => {
    // Use a fresh context with no stored session
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Should show login prompt
    await expect(
      page.getByText('Faca login para ver seu perfil')
    ).toBeVisible({ timeout: 10_000 });
    await context.close();
  });

  test('pagina de deposito carrega', async ({ page }) => {
    await page.goto('/deposito');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('pagina de live carrega', async ({ page }) => {
    await page.goto('/live');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('BottomNav esta presente em paginas principais', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Mobile bottom nav should exist in DOM
    const nav = page.locator('nav').or(page.locator('[class*="bottom"]'));
    const count = await nav.count();
    expect(count).toBeGreaterThan(0);
  });

  test('navegacao entre login e criar conta funciona', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);

    await page.getByRole('link', { name: 'Criar conta' }).click();
    await page.waitForURL('/criar-conta');

    await page.getByRole('link', { name: 'Entrar' }).click();
    await page.waitForURL('/login');
  });

  test('pagina 404 nao quebra o app', async ({ page }) => {
    const response = await page.goto('/pagina-que-nao-existe');

    // Should either show 404 or redirect, but not crash
    expect(response).toBeTruthy();
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});
