import { Page, expect } from '@playwright/test';

// ---- Test User Data ----
export const TEST_USER = {
  name: 'Teste Playwright',
  email: `playwright_${Date.now()}@test.com`,
  phone: '11999999999',
  cpf: '12345678901',
  password: 'teste123',
};

// Generate unique email per test run
export function uniqueEmail(): string {
  return `pw_${Date.now()}_${Math.random().toString(36).slice(2, 5)}@test.com`;
}

// ---- Auth Helpers ----

export async function registerUser(page: Page, user = TEST_USER) {
  await page.goto('/criar-conta');
  await page.waitForLoadState('networkidle');

  // Step 1: Personal data
  await page.getByPlaceholder('Seu nome completo').fill(user.name);
  await page.getByPlaceholder('seu@email.com').fill(user.email);
  await page.getByPlaceholder('(11) 99999-9999').fill(user.phone);
  await page.getByPlaceholder('000.000.000-00').fill(user.cpf);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 2: Password
  await page.getByPlaceholder('Minimo 6 caracteres').fill(user.password);
  await page.getByPlaceholder('Repita a senha').fill(user.password);
  await page.getByRole('button', { name: 'Criar Conta' }).click();

  // Should redirect to home
  await page.waitForURL('/', { timeout: 15_000 });
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('Sua senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL('/', { timeout: 15_000 });
}

export async function logoutUser(page: Page) {
  await page.goto('/perfil');
  await page.waitForLoadState('networkidle');

  // Click logout in profile page
  const logoutBtn = page.getByText('Sair da conta');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
}

// ---- Session Helpers ----

export async function injectSession(page: Page, email: string) {
  await page.evaluate((em) => {
    localStorage.setItem('previsao_session', em);
  }, email);
}

export async function clearSession(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('previsao_session');
  });
}

export async function getStoredSession(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('previsao_session'));
}

// ---- Navigation Helpers ----

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait a bit for React hydration
  await page.waitForTimeout(500);
}

// ---- Assertion Helpers ----

export async function expectToastOrError(page: Page, text: string) {
  const error = page.locator(`text=${text}`);
  await expect(error).toBeVisible({ timeout: 10_000 });
}

export async function expectRedirectTo(page: Page, path: string) {
  await page.waitForURL(path, { timeout: 15_000 });
  expect(page.url()).toContain(path);
}

// ---- API Helpers ----

export async function apiGetMarkets(page: Page, status = 'open') {
  const response = await page.request.get(`/api/markets?status=${status}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function apiPlaceBet(page: Page, data: {
  market_id: string;
  outcome_key: string;
  outcome_label: string;
  amount: number;
  user_id: string;
}) {
  const response = await page.request.post('/api/markets/bet', { data });
  return response.json();
}

/**
 * Fund a test user with balance via the test-fund API route.
 * Requires the test user to already exist in the database.
 */
export async function fundTestUser(page: Page, userEmail: string, amount: number) {
  const response = await page.request.post('/api/test/fund-user', {
    data: { email: userEmail, amount, secret: process.env.ADMIN_SECRET || 'admin' },
  });
  const data = await response.json();
  if (!response.ok()) {
    throw new Error(`Failed to fund user: ${data.error}`);
  }
  return data;
}

/**
 * Register a user, login, and return their user_id for API calls.
 */
export async function createFundedTestUser(page: Page, amount = 500): Promise<{ email: string; userId: string }> {
  const email = uniqueEmail();

  // Register
  await page.goto('/criar-conta');
  await waitForPageLoad(page);
  await page.getByPlaceholder('Seu nome completo').fill('Teste Aposta');
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('(11) 99999-9999').fill('11999887766');
  await page.getByPlaceholder('000.000.000-00').fill('12345678901');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByPlaceholder('Minimo 6 caracteres').fill('teste123');
  await page.getByPlaceholder('Repita a senha').fill('teste123');
  await page.getByRole('button', { name: 'Criar Conta' }).click();
  await page.waitForURL('/', { timeout: 15_000 });

  // Fund the user
  const fundData = await fundTestUser(page, email, amount);

  return { email, userId: fundData.userId };
}
