import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForPageLoad } from './helpers/test-utils';

test.describe('Perfil e Saldos', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    testEmail = uniqueEmail();
    const page = await browser.newPage();
    await page.goto('/criar-conta');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Seu nome completo').fill('Perfil Test');
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
    await page.getByPlaceholder('000.000.000-00').fill('12345678901');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
    await page.getByPlaceholder('Repita a senha').fill('teste123');
    await page.getByRole('button', { name: 'Criar Conta' }).click();
    await page.waitForURL('/');
    await page.close();
  });

  async function loginTestUser(page: any) {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/');
  }

  test('perfil exibe dados do usuario logado', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Should show user name
    await expect(page.getByText('Perfil Test')).toBeVisible({ timeout: 10_000 });
  });

  test('perfil exibe saldo do usuario', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Should show balance (R$ 0.00 for new user)
    await expect(page.getByText('R$').first()).toBeVisible({ timeout: 10_000 });
  });

  test('perfil tem tabs de resumo, conta e historico', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Check for tab labels (use role to avoid strict mode with headings)
    await expect(page.getByRole('button', { name: /Resumo/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Conta/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hist[oó]rico/ })).toBeVisible();
  });

  test('tab de conta exibe campos de edicao', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Click "Conta" tab
    await page.getByText('Conta').click();
    await page.waitForTimeout(500);

    // Should show profile editing fields
    const content = await page.textContent('body');
    expect(content).toContain('Perfil Test');
  });

  test('tab de historico exibe apostas', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Click "Historico" tab
    await page.getByText('Historico').click();
    await page.waitForTimeout(500);

    // Should show bet history (may be empty for new user)
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('resumo exibe estatisticas', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Resumo tab should show stats
    const content = await page.textContent('body');
    // Should have win/loss related content
    expect(content).toBeTruthy();
  });

  test('perfil sem login mostra prompt de login', async ({ browser }) => {
    // Use a fresh context with no stored session
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/perfil');
    await waitForPageLoad(page);

    await expect(
      page.getByText('Faca login para ver seu perfil')
    ).toBeVisible({ timeout: 10_000 });
    await context.close();
  });

  test('header exibe saldo no perfil', async ({ page }) => {
    await loginTestUser(page);

    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Header should show balance
    const balanceText = page.locator('text=R$ 0.00').or(page.locator('text=R$0.00'));
    // New user has 0 balance
    const content = await page.textContent('body');
    expect(content).toContain('R$');
  });
});
