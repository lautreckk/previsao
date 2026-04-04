export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const PROVIDERS_STATUS = [
  { name: "Binance", test: () => fetch("https://api.binance.com/api/v3/ping").then((r) => r.ok) },
  { name: "AwesomeAPI", test: () => fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL").then((r) => r.ok) },
  {
    name: "OpenWeather",
    test: () => {
      const k = process.env.OPENWEATHER_API_KEY;
      if (!k) return Promise.resolve(false);
      return fetch(`https://api.openweathermap.org/data/2.5/weather?id=3448439&appid=${k}&units=metric`).then((r) => r.ok);
    },
  },
  {
    name: "brapi.dev",
    test: () => fetch("https://brapi.dev/api/quote/PETR4").then((r) => r.ok),
  },
  {
    name: "API-Football",
    test: () => {
      const k = process.env.API_FOOTBALL_KEY;
      if (!k) return Promise.resolve(false);
      return fetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": k } }).then((r) => r.ok);
    },
  },
];

/**
 * GET /api/v1/health
 *
 * Returns API status and provider connectivity. No auth required.
 */
export async function GET() {
  const start = Date.now();

  const providers = await Promise.all(
    PROVIDERS_STATUS.map(async (p) => {
      const t0 = Date.now();
      try {
        const ok = await Promise.race([
          p.test(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
        ]);
        return { name: p.name, status: ok ? "ok" : "down", latency_ms: Date.now() - t0 };
      } catch {
        return { name: p.name, status: "error", latency_ms: Date.now() - t0 };
      }
    })
  );

  const allOk = providers.every((p) => p.status === "ok");

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    version: "1.0.0",
    uptime_ms: Date.now() - start,
    providers,
    // env config removed — internal details should not be exposed publicly
    endpoints: {
      health: "GET /api/v1/health",
      crypto: "GET /api/v1/prices/crypto?symbols=BTC,ETH&currency=BRL",
      forex: "GET /api/v1/prices/forex?pairs=USD/BRL,EUR/BRL",
      stocks: "GET /api/v1/prices/stocks?symbols=PETR4,VALE3 or ?preset=ibovespa_top10",
      weather: "GET /api/v1/weather?city=sao-paulo&forecast=true",
      sports: "GET /api/v1/sports?league=brasileirao_a or ?league=live",
      resolve: "POST /api/v1/resolve { market_id, market_type, params }",
    },
    timestamp: new Date().toISOString(),
  });
}
