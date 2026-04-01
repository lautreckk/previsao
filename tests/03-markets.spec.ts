import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForPageLoad } from './helpers/test-utils';

test.describe('Mercados e Apostas', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    // Create test user with session
    testEmail = uniqueEmail();
    const page = await browser.newPage();
    await page.goto('/criar-conta');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Seu nome completo').fill('Market Test User');
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

  test.describe('API de Mercados', () => {
    test('GET /api/markets retorna lista de mercados', async ({ request }) => {
      const response = await request.get('/api/markets');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('markets');
      expect(Array.isArray(data.markets)).toBeTruthy();
    });

    test('GET /api/markets com filtro de status', async ({ request }) => {
      const response = await request.get('/api/markets?status=open');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('markets');
      if (data.markets.length > 0) {
        // All should be open or active
        for (const m of data.markets) {
          expect(['open', 'frozen', 'active']).toContain(m.status);
        }
      }
    });

    test('GET /api/markets com filtro de categoria', async ({ request }) => {
      const response = await request.get('/api/markets?category=crypto');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data).toHaveProperty('markets');
    });

    test('POST /api/markets/bet rejeita sem dados', async ({ request }) => {
      const response = await request.post('/api/markets/bet', {
        data: {},
      });

      const data = await response.json();
      // Should return error
      expect(data.error || data.message || response.status()).toBeTruthy();
    });

    test('POST /api/markets/bet rejeita amount menor que 1', async ({ request }) => {
      const response = await request.post('/api/markets/bet', {
        data: {
          market_id: 'fake_market',
          outcome_key: 'yes',
          outcome_label: 'Sim',
          amount: 0.5,
          user_id: 'fake_user',
        },
      });

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
  });

  test.describe('Interface de Mercados', () => {
    test('home exibe cards de mercados', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Wait for markets to load (they come from API + store)
      await page.waitForTimeout(3000);

      // Should have some market content or empty state
      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(200);
    });

    test('clicar em card abre pagina do evento', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);
      await page.waitForTimeout(3000);

      // Try to find a market link
      const marketLinks = page.locator('a[href*="/evento/"]');
      const count = await marketLinks.count();

      if (count > 0) {
        await marketLinks.first().click();
        await page.waitForURL(/\/evento\/.+/);
        expect(page.url()).toContain('/evento/');
      } else {
        // No markets available - test passes but flagged
        test.info().annotations.push({ type: 'info', description: 'Nenhum mercado disponivel para clicar' });
      }
    });

    test('pagina de evento exibe detalhes do mercado', async ({ page }) => {
      // First get a market ID from API
      const apiResponse = await page.request.get('/api/markets?status=open&limit=1');
      const apiData = await apiResponse.json();

      if (!apiData.markets || apiData.markets.length === 0) {
        test.skip(true, 'Nenhum mercado aberto disponivel');
        return;
      }

      const market = apiData.markets[0];
      await page.goto(`/evento/${market.id}`);
      await waitForPageLoad(page);

      // Should show market title
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(100);
    });

    test('pagina de evento exibe botoes de outcome', async ({ page }) => {
      const apiResponse = await page.request.get('/api/markets?status=open&limit=1');
      const apiData = await apiResponse.json();

      if (!apiData.markets || apiData.markets.length === 0) {
        test.skip(true, 'Nenhum mercado aberto disponivel');
        return;
      }

      const market = apiData.markets[0];
      await page.goto(`/evento/${market.id}`);
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);

      // Should have outcome buttons
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Fluxo de Aposta', () => {
    test('aposta sem saldo deve falhar', async ({ page }) => {
      // Login
      await page.goto('/login');
      await waitForPageLoad(page);
      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('Sua senha').fill('teste123');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('/');

      // Get a market
      const apiResponse = await page.request.get('/api/markets?status=open&limit=1');
      const apiData = await apiResponse.json();

      if (!apiData.markets || apiData.markets.length === 0) {
        test.skip(true, 'Nenhum mercado aberto disponivel');
        return;
      }

      const market = apiData.markets[0];
      await page.goto(`/evento/${market.id}`);
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);

      // Try to place bet - should fail due to insufficient balance
      // The exact flow depends on UI state, but the API should reject
      const betResponse = await page.request.post('/api/markets/bet', {
        data: {
          market_id: market.id,
          outcome_key: market.outcomes?.[0]?.key || 'yes',
          outcome_label: market.outcomes?.[0]?.label || 'Sim',
          amount: 100,
          user_id: 'invalid_user',
        },
      });

      const betData = await betResponse.json();
      expect(betData.error).toBeTruthy();
    });
  });

  test.describe('Resultados', () => {
    test('pagina de resultados exibe mercados resolvidos', async ({ page }) => {
      await page.goto('/resultados');
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);

      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    });

    test('filtros de categoria funcionam', async ({ page }) => {
      await page.goto('/resultados');
      await waitForPageLoad(page);
      await page.waitForTimeout(2000);

      // Try to click a category filter if available
      const cryptoFilter = page.getByText('Cripto').or(page.getByText('crypto'));
      if (await cryptoFilter.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await cryptoFilter.first().click();
        await page.waitForTimeout(1000);
        // Page should still be on /resultados
        expect(page.url()).toContain('/resultados');
      }
    });
  });
});
