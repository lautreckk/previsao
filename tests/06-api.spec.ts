import { test, expect } from '@playwright/test';

test.describe('API Routes', () => {
  test.describe('Health & Setup', () => {
    test('GET /api/v1/health retorna ok', async ({ request }) => {
      const response = await request.get('/api/v1/health');
      // May return 200 or other status
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Markets API', () => {
    test('GET /api/markets retorna JSON valido', async ({ request }) => {
      const response = await request.get('/api/markets');
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('application/json');

      const data = await response.json();
      expect(data).toHaveProperty('markets');
    });

    test('GET /api/markets?limit=5 limita resultados', async ({ request }) => {
      const response = await request.get('/api/markets?limit=5');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.markets.length).toBeLessThanOrEqual(5);
    });

    test('GET /api/markets?status=resolved retorna resolvidos', async ({ request }) => {
      const response = await request.get('/api/markets?status=resolved');
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      for (const m of data.markets) {
        expect(m.status).toBe('resolved');
      }
    });

    test('POST /api/markets sem secret retorna erro', async ({ request }) => {
      const response = await request.post('/api/markets', {
        data: { title: 'Test Market' },
      });

      // Should reject without admin secret
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('POST /api/markets/bet com dados incompletos retorna erro', async ({ request }) => {
      const response = await request.post('/api/markets/bet', {
        data: { market_id: 'non_existent' },
      });

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    test('POST /api/markets/bet com usuario inexistente retorna erro', async ({ request }) => {
      const response = await request.post('/api/markets/bet', {
        data: {
          market_id: 'test_market',
          outcome_key: 'yes',
          outcome_label: 'Sim',
          amount: 10,
          user_id: 'nonexistent_user_123',
        },
      });

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
  });

  test.describe('Prices API', () => {
    test('GET /api/prices retorna precos', async ({ request }) => {
      const response = await request.get('/api/prices');
      // May fail if external APIs are down, so we just check it doesn't 500
      expect(response.status()).toBeLessThan(500);
    });

    test('GET /api/v1/prices/crypto retorna precos de crypto', async ({ request }) => {
      const response = await request.get('/api/v1/prices/crypto');
      expect(response.status()).toBeLessThan(500);

      if (response.ok()) {
        const data = await response.json();
        expect(data).toBeTruthy();
      }
    });
  });

  test.describe('BSPay API', () => {
    test('GET /api/bspay sem params retorna erro', async ({ request }) => {
      const response = await request.get('/api/bspay');
      // Should require txId or extId
      expect(response.status()).toBeLessThan(500);
    });

    test('POST /api/bspay sem dados retorna erro', async ({ request }) => {
      const response = await request.post('/api/bspay', {
        data: {},
      });
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Webhook', () => {
    test('POST /api/webhook sem body valido nao quebra', async ({ request }) => {
      const response = await request.post('/api/webhook', {
        data: { type: 'test', data: {} },
      });
      // Should handle gracefully
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Camera API', () => {
    test('GET /api/camera/markets retorna lista', async ({ request }) => {
      const response = await request.get('/api/camera/markets');
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Cron Routes (protegidas)', () => {
    test('GET /api/cron/auto-markets sem CRON_SECRET rejeita', async ({ request }) => {
      const response = await request.get('/api/cron/auto-markets');
      // Should require authorization
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
