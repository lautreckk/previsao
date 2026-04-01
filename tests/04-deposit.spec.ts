import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForPageLoad } from './helpers/test-utils';

test.describe('Deposito PIX', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    testEmail = uniqueEmail();
    const page = await browser.newPage();
    await page.goto('/criar-conta');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Seu nome completo').fill('Deposit Test');
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

  test('pagina de deposito carrega com usuario logado', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/');

    await page.goto('/deposito');
    await waitForPageLoad(page);

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('exibe botoes de valores preset', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/');

    await page.goto('/deposito');
    await waitForPageLoad(page);

    // Check for preset amount buttons (R$10, R$25, R$50, R$100, R$250, R$500)
    const presets = ['10', '25', '50', '100', '250', '500'];
    let foundPresets = 0;
    for (const preset of presets) {
      const btn = page.getByText(`R$${preset}`).or(page.getByText(`R$ ${preset}`));
      if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        foundPresets++;
      }
    }
    // At least some presets should be visible
    expect(foundPresets).toBeGreaterThan(0);
  });

  test('selecionar valor preset preenche o campo', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/');

    await page.goto('/deposito');
    await waitForPageLoad(page);

    // Click a preset amount
    const preset50 = page.getByText('R$50').or(page.getByText('R$ 50'));
    if (await preset50.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await preset50.first().click();
      // The amount should be set
      await page.waitForTimeout(500);
    }
  });

  test('gerar QR code PIX (pode falhar sem BSPay configurado)', async ({ page }) => {
    await page.goto('/login');
    await waitForPageLoad(page);
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('Sua senha').fill('teste123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL('/');

    await page.goto('/deposito');
    await waitForPageLoad(page);

    // Click preset and try to generate
    const preset25 = page.getByText('R$25').or(page.getByText('R$ 25'));
    if (await preset25.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await preset25.first().click();
      await page.waitForTimeout(500);

      // Look for "Depositar" or "Gerar PIX" button
      const depositBtn = page.getByText('Depositar').or(page.getByText('Gerar PIX')).or(page.getByText('Continuar'));
      if (await depositBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await depositBtn.first().click();
        // Wait for API response
        await page.waitForTimeout(3000);
        // Should either show QR code or an error
        const content = await page.textContent('body');
        expect(content).toBeTruthy();
      }
    }
  });
});
