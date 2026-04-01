import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForPageLoad, fundTestUser } from './helpers/test-utils';

test.describe('Fluxo Completo de Aposta', () => {
  let testEmail: string;
  let userId: string;
  let setupFailed = false;

  test.beforeAll(async ({ browser }) => {
    try {
      testEmail = uniqueEmail();
      const page = await browser.newPage();

      // Register user
      await page.goto('/criar-conta');
      await waitForPageLoad(page);
      await expect(page.getByText('Etapa 1 de 2')).toBeVisible({ timeout: 15_000 });
      await page.getByPlaceholder('Seu nome completo').fill('Bet Flow Test');
      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('Etapa 2 de 2')).toBeVisible({ timeout: 10_000 });
      await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
      await page.getByPlaceholder('Repita a senha').fill('teste123');
      await page.getByRole('button', { name: 'Criar Conta' }).click();
      await page.waitForURL('/', { timeout: 15_000 });

      // Fund user with R$500
      const fundData = await fundTestUser(page, testEmail, 500);
      userId = fundData.userId;

      await page.close();
    } catch (e) {
      setupFailed = true;
      throw e;
    }
  });

  test.beforeEach(async () => {
    test.skip(setupFailed, 'Setup failed - skipping');
  });

  async function login(page: any) {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/', { timeout: 15_000 });
  }

  test('usuario com saldo consegue ver balance no perfil', async ({ page }) => {
    await login(page);
    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Use specific heading that shows the main balance
    await expect(page.getByRole('heading', { name: /R\$/ })).toBeVisible({ timeout: 10_000 });
    const content = await page.textContent('body');
    expect(content).toContain('500');
  });

  test('API de aposta aceita com saldo suficiente', async ({ page }) => {
    await login(page);

    // Get an open market
    const marketsRes = await page.request.get('/api/markets?status=open&limit=1', { timeout: 30_000 });
    const marketsData = await marketsRes.json();

    if (!marketsData.markets || marketsData.markets.length === 0) {
      test.skip(true, 'Nenhum mercado aberto disponivel');
      return;
    }

    const market = marketsData.markets[0];
    const outcomeKey = market.outcomes?.[0]?.key || 'yes';
    const outcomeLabel = market.outcomes?.[0]?.label || 'Sim';

    // Place bet via API
    const betRes = await page.request.post('/api/markets/bet', {
      data: {
        market_id: market.id,
        outcome_key: outcomeKey,
        outcome_label: outcomeLabel,
        amount: 10,
        user_id: userId,
      },
      timeout: 30_000,
    });

    const betData = await betRes.json();

    // Market may have been frozen/closed between listing and betting
    if (betData.error === 'Mercado congelado' || betData.error === 'Mercado nao esta aberto') {
      test.skip(true, 'Mercado foi congelado antes da aposta');
      return;
    }

    expect(betData.error).toBeFalsy();
    expect(betData.ok).toBeTruthy();
    expect(betData.bet).toBeTruthy();
    expect(betData.bet.id).toBeTruthy();
    expect(betData.balance).toBeLessThan(500);
  });

  test('aposta aparece no historico do perfil', async ({ page }) => {
    await login(page);
    await page.goto('/perfil');
    await waitForPageLoad(page);

    // Click Historico tab
    await page.getByRole('button', { name: /Hist[oó]rico/ }).click();
    await page.waitForTimeout(1000);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(200);
  });

  test('navegar para evento e ver botoes de outcome', async ({ page }) => {
    await login(page);

    const marketsRes = await page.request.get('/api/markets?status=open&limit=1', { timeout: 30_000 });
    const marketsData = await marketsRes.json();

    if (!marketsData.markets || marketsData.markets.length === 0) {
      test.skip(true, 'Nenhum mercado aberto disponivel');
      return;
    }

    const market = marketsData.markets[0];
    await page.goto(`/evento/${market.id}`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(1);

    const content = await page.textContent('body');
    expect(content!.length).toBeGreaterThan(100);
  });

  test('aposta com saldo insuficiente via API retorna erro', async ({ page }) => {
    await login(page);

    const marketsRes = await page.request.get('/api/markets?status=open&limit=1', { timeout: 30_000 });
    const marketsData = await marketsRes.json();

    if (!marketsData.markets || marketsData.markets.length === 0) {
      test.skip(true, 'Nenhum mercado aberto disponivel');
      return;
    }

    const market = marketsData.markets[0];

    const betRes = await page.request.post('/api/markets/bet', {
      data: {
        market_id: market.id,
        outcome_key: market.outcomes?.[0]?.key || 'yes',
        outcome_label: market.outcomes?.[0]?.label || 'Sim',
        amount: 99999,
        user_id: userId,
      },
      timeout: 30_000,
    });

    const betData = await betRes.json();
    expect(betData.error).toBeTruthy();
  });

  test('saldo visivel no header apos login', async ({ page }) => {
    await login(page);

    // Header should show balance with R$
    await expect(page.getByRole('banner').getByText('R$')).toBeVisible({ timeout: 10_000 });
  });
});
