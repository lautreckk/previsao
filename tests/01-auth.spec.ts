import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForPageLoad } from './helpers/test-utils';

test.describe('Autenticacao', () => {
  test.describe('Criar Conta', () => {
    test('deve criar conta com dados validos e redirecionar para home', async ({ page }) => {
      const email = uniqueEmail();
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      // Step 1
      await expect(page.getByText('Etapa 1 de 2')).toBeVisible();
      await page.getByPlaceholder('Seu nome completo').fill('Teste Playwright');
      await page.getByPlaceholder('seu@email.com').fill(email);
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      // Step 2
      await expect(page.getByText('Etapa 2 de 2')).toBeVisible();
      await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
      await page.getByPlaceholder('Repita a senha').fill('teste123');
      await page.getByRole('button', { name: 'Criar Conta' }).click();

      // Should redirect to home
      await page.waitForURL('/', { timeout: 15_000 });
      expect(page.url()).toContain('/');
    });

    test('deve mostrar erro com nome curto', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      await page.getByPlaceholder('Seu nome completo').fill('AB');
      await page.getByPlaceholder('seu@email.com').fill('test@test.com');
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      await expect(page.getByText('Digite seu nome completo')).toBeVisible();
    });

    test('deve mostrar erro com email invalido', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      await page.getByPlaceholder('Seu nome completo').fill('Teste User');
      await page.getByPlaceholder('seu@email.com').fill('emailinvalido');
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      await expect(page.getByText('Digite um e-mail valido')).toBeVisible();
    });

    test('deve mostrar erro com CPF incompleto', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      await page.getByPlaceholder('Seu nome completo').fill('Teste User');
      await page.getByPlaceholder('seu@email.com').fill('test@test.com');
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('123');
      await page.getByRole('button', { name: 'Continuar' }).click();

      await expect(page.getByText('Digite um CPF valido')).toBeVisible();
    });

    test('deve mostrar erro com telefone curto', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      await page.getByPlaceholder('Seu nome completo').fill('Teste User');
      await page.getByPlaceholder('seu@email.com').fill('test@test.com');
      await page.getByPlaceholder('(11) 99999-9999').fill('119');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      await expect(page.getByText('Digite um telefone valido')).toBeVisible();
    });

    test('deve mostrar erro com senha curta', async ({ page }) => {
      const email = uniqueEmail();
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      // Pass step 1
      await page.getByPlaceholder('Seu nome completo').fill('Teste User');
      await page.getByPlaceholder('seu@email.com').fill(email);
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      // Step 2 with short password
      await page.getByPlaceholder('Minimo 6 caracteres').fill('12345');
      await page.getByPlaceholder('Repita a senha').fill('12345');
      await page.getByRole('button', { name: 'Criar Conta' }).click();

      await expect(page.getByText('A senha deve ter no minimo 6 caracteres')).toBeVisible();
    });

    test('deve mostrar erro quando senhas nao coincidem', async ({ page }) => {
      const email = uniqueEmail();
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      await page.getByPlaceholder('Seu nome completo').fill('Teste User');
      await page.getByPlaceholder('seu@email.com').fill(email);
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();

      await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
      await page.getByPlaceholder('Repita a senha').fill('outrasenha');
      await page.getByRole('button', { name: 'Criar Conta' }).click();

      await expect(page.getByText('As senhas nao coincidem')).toBeVisible();
    });

    test('deve formatar CPF automaticamente', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      const cpfInput = page.getByPlaceholder('000.000.000-00');
      await cpfInput.fill('12345678901');
      const value = await cpfInput.inputValue();
      expect(value).toBe('123.456.789-01');
    });

    test('deve ter link para pagina de login', async ({ page }) => {
      await page.goto('/criar-conta');
      await waitForPageLoad(page);

      const loginLink = page.getByRole('link', { name: 'Entrar' });
      await expect(loginLink).toBeVisible();
      await expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  test.describe('Login', () => {
    let testEmail: string;

    test.beforeAll(async ({ browser }) => {
      // Create a test user first
      testEmail = uniqueEmail();
      const page = await browser.newPage();
      await page.goto('/criar-conta');
      await page.waitForLoadState('networkidle');
      await page.getByPlaceholder('Seu nome completo').fill('Login Test User');
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

    test('deve logar com credenciais validas', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('Sua senha').fill('teste123');
      await page.getByRole('button', { name: 'Entrar' }).click();

      await page.waitForURL('/', { timeout: 15_000 });
    });

    test('deve mostrar erro com senha errada', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('Sua senha').fill('senhaerrada');
      await page.getByRole('button', { name: 'Entrar' }).click();

      await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible();
    });

    test('deve mostrar erro com campos vazios', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      await page.getByRole('button', { name: 'Entrar' }).click();

      await expect(page.getByText('Preencha todos os campos')).toBeVisible();
    });

    test('deve ter link para criar conta', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      const link = page.getByRole('link', { name: 'Criar conta' });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', '/criar-conta');
    });

    test('deve persistir sessao no localStorage', async ({ page }) => {
      await page.goto('/login');
      await waitForPageLoad(page);

      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('Sua senha').fill('teste123');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('/');

      const session = await page.evaluate(() => localStorage.getItem('previsao_session'));
      expect(session).toBe(testEmail.toLowerCase());
    });

    test('deve restaurar sessao ao recarregar', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await waitForPageLoad(page);
      await page.getByPlaceholder('seu@email.com').fill(testEmail);
      await page.getByPlaceholder('Sua senha').fill('teste123');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('/');

      // Reload
      await page.reload();
      await waitForPageLoad(page);

      // Session should persist - balance should be visible in header
      const session = await page.evaluate(() => localStorage.getItem('previsao_session'));
      expect(session).toBe(testEmail.toLowerCase());
    });
  });

  test.describe('Logout', () => {
    test('deve limpar sessao ao fazer logout', async ({ page }) => {
      // Register + login
      const email = uniqueEmail();
      await page.goto('/criar-conta');
      await waitForPageLoad(page);
      await page.getByPlaceholder('Seu nome completo').fill('Logout Test');
      await page.getByPlaceholder('seu@email.com').fill(email);
      await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
      await page.getByPlaceholder('000.000.000-00').fill('12345678901');
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
      await page.getByPlaceholder('Repita a senha').fill('teste123');
      await page.getByRole('button', { name: 'Criar Conta' }).click();
      await page.waitForURL('/');

      // Go to profile and click "Conta" tab where logout button lives
      await page.goto('/perfil');
      await waitForPageLoad(page);

      await page.getByText('Conta').first().click();
      await page.waitForTimeout(500);

      // Find and click logout
      const logoutBtn = page.getByText('Sair da Conta');
      await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
      await logoutBtn.click();

      // Wait for redirect and check session cleared
      await page.waitForTimeout(1000);
      const session = await page.evaluate(() => localStorage.getItem('previsao_session'));
      expect(session).toBeNull();
    });
  });
});
