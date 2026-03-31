export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { cached } from "../../_lib/cache";
import type { PriceData } from "../../_lib/types";

// Forex pairs available via Binance (USDT-based) + AwesomeAPI for traditional forex
// All pairs use AwesomeAPI (free, no key, no region block)
// Binance is blocked in some Vercel regions (HTTP 451)
const FOREX_PAIRS: Record<string, { source: "awesome"; symbol: string; name: string }> = {
  "USD/BRL": { source: "awesome", symbol: "USD-BRL", name: "Dolar Americano" },
  "EUR/BRL": { source: "awesome", symbol: "EUR-BRL", name: "Euro" },
  "GBP/BRL": { source: "awesome", symbol: "GBP-BRL", name: "Libra Esterlina" },
  "BTC/BRL": { source: "awesome", symbol: "BTC-BRL", name: "Bitcoin" },
  "ETH/BRL": { source: "awesome", symbol: "ETH-BRL", name: "Ethereum" },
  "EUR/USD": { source: "awesome", symbol: "EUR-USD", name: "Euro/Dolar" },
  "JPY/BRL": { source: "awesome", symbol: "JPY-BRL", name: "Iene Japones" },
  "ARS/BRL": { source: "awesome", symbol: "ARS-BRL", name: "Peso Argentino" },
};

async function fetchBinanceForex(symbol: string) {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const d = await res.json();
  return {
    price: parseFloat(d.lastPrice),
    change: parseFloat(d.priceChange),
    changePercent: parseFloat(d.priceChangePercent),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
    volume: parseFloat(d.quoteVolume),
  };
}

async function fetchAwesomeApi(symbol: string) {
  // AwesomeAPI - free Brazilian forex API (no key needed)
  const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${symbol}`);
  if (!res.ok) throw new Error(`AwesomeAPI error: ${res.status}`);
  const json = await res.json();
  const key = symbol.replace("-", "");
  const d = json[key];
  return {
    price: parseFloat(d.bid),
    change: parseFloat(d.varBid),
    changePercent: parseFloat(d.pctChange),
    high: parseFloat(d.high),
    low: parseFloat(d.low),
    volume: 0,
  };
}

/**
 * GET /api/v1/prices/forex
 *
 * Query params:
 *   pairs - comma-separated (default: USD/BRL,EUR/BRL)
 *
 * Example: /api/v1/prices/forex?pairs=USD/BRL,EUR/BRL,BTC/BRL
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const pairsParam = searchParams.get("pairs") || "USD/BRL,EUR/BRL";
  const pairs = pairsParam.split(",").map((p) => p.trim().toUpperCase());

  const invalid = pairs.filter((p) => !FOREX_PAIRS[p]);
  if (invalid.length > 0) {
    return apiError(`Unknown pairs: ${invalid.join(", ")}. Available: ${Object.keys(FOREX_PAIRS).join(", ")}`, 400);
  }

  try {
    const results = await Promise.all(
      pairs.map(async (pair) => {
        const config = FOREX_PAIRS[pair];
        const { data: ticker, cached: wasCached, fetched_at } = await cached(
          `forex_${pair}`,
          30, // 30s cache for forex
          () => fetchAwesomeApi(config.symbol)
        );

        const price: PriceData = {
          symbol: pair,
          name: config.name,
          price: parseFloat(ticker.price.toFixed(4)),
          currency: "BRL",
          change_24h: parseFloat(ticker.change.toFixed(4)),
          change_percent_24h: parseFloat(ticker.changePercent.toFixed(2)),
          high_24h: parseFloat(ticker.high.toFixed(4)),
          low_24h: parseFloat(ticker.low.toFixed(4)),
          volume_24h: ticker.volume,
          source: config.source === "binance" ? "binance" : "awesomeapi",
          updated_at: fetched_at,
        };

        return { ...price, _cached: wasCached };
      })
    );

    return apiSuccess(results, {
      available_pairs: Object.keys(FOREX_PAIRS),
    });
  } catch (err) {
    return apiError(`Failed to fetch forex: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
