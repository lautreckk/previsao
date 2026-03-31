export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { cached } from "../../_lib/cache";
import type { PriceData } from "../../_lib/types";

// CoinGecko IDs (free, no key, no region block)
const CRYPTO_MAP: Record<string, { cgId: string; name: string; binance?: string }> = {
  BTC: { cgId: "bitcoin", name: "Bitcoin", binance: "BTCUSDT" },
  ETH: { cgId: "ethereum", name: "Ethereum", binance: "ETHUSDT" },
  SOL: { cgId: "solana", name: "Solana", binance: "SOLUSDT" },
  BNB: { cgId: "binancecoin", name: "Binance Coin", binance: "BNBUSDT" },
  XRP: { cgId: "ripple", name: "Ripple", binance: "XRPUSDT" },
  ADA: { cgId: "cardano", name: "Cardano", binance: "ADAUSDT" },
  DOGE: { cgId: "dogecoin", name: "Dogecoin", binance: "DOGEUSDT" },
  DOT: { cgId: "polkadot", name: "Polkadot", binance: "DOTUSDT" },
  AVAX: { cgId: "avalanche-2", name: "Avalanche", binance: "AVAXUSDT" },
  MATIC: { cgId: "matic-network", name: "Polygon", binance: "MATICUSDT" },
  LINK: { cgId: "chainlink", name: "Chainlink", binance: "LINKUSDT" },
  UNI: { cgId: "uniswap", name: "Uniswap", binance: "UNIUSDT" },
  SHIB: { cgId: "shiba-inu", name: "Shiba Inu", binance: "SHIBUSDT" },
  LTC: { cgId: "litecoin", name: "Litecoin", binance: "LTCUSDT" },
  NEAR: { cgId: "near", name: "NEAR Protocol", binance: "NEARUSDT" },
};

// CoinGecko free API (no key needed, 30 req/min)
async function fetchCoinGeckoPrices(symbols: string[], currency: string): Promise<Record<string, {
  price: number; change24h: number; changePercent24h: number;
  high24h: number; low24h: number; volume24h: number; marketCap: number;
}>> {
  const ids = symbols.map((s) => CRYPTO_MAP[s]?.cgId).filter(Boolean).join(",");
  const vsCurrency = currency.toLowerCase();

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vsCurrency}&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const result: Record<string, {
    price: number; change24h: number; changePercent24h: number;
    high24h: number; low24h: number; volume24h: number; marketCap: number;
  }> = {};

  for (const coin of data) {
    // Find our symbol key by cgId
    const sym = Object.entries(CRYPTO_MAP).find(([, v]) => v.cgId === coin.id)?.[0];
    if (sym) {
      result[sym] = {
        price: coin.current_price || 0,
        change24h: coin.price_change_24h || 0,
        changePercent24h: coin.price_change_percentage_24h || 0,
        high24h: coin.high_24h || 0,
        low24h: coin.low_24h || 0,
        volume24h: coin.total_volume || 0,
        marketCap: coin.market_cap || 0,
      };
    }
  }

  return result;
}

// Binance fallback (may be blocked in some Vercel regions)
async function fetchBinancePrices(symbols: string[]): Promise<Record<string, {
  price: number; change24h: number; changePercent24h: number;
  high24h: number; low24h: number; volume24h: number; marketCap: number;
}>> {
  const result: Record<string, {
    price: number; change24h: number; changePercent24h: number;
    high24h: number; low24h: number; volume24h: number; marketCap: number;
  }> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      const binanceSymbol = CRYPTO_MAP[sym]?.binance;
      if (!binanceSymbol) return;
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`);
        if (!res.ok) return;
        const d = await res.json();
        result[sym] = {
          price: parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChange),
          changePercent24h: parseFloat(d.priceChangePercent),
          high24h: parseFloat(d.highPrice),
          low24h: parseFloat(d.lowPrice),
          volume24h: parseFloat(d.quoteVolume),
          marketCap: 0,
        };
      } catch { /* skip */ }
    })
  );

  return result;
}

/**
 * GET /api/v1/prices/crypto
 *
 * Query params:
 *   symbols  - comma-separated (default: BTC,ETH,SOL)
 *   currency - BRL or USD (default: BRL)
 *
 * Uses CoinGecko (global, free) as primary source.
 * Falls back to Binance if CoinGecko is rate-limited.
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") || "BTC,ETH,SOL";
  const currency = (searchParams.get("currency") || "BRL").toUpperCase();
  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

  const invalid = symbols.filter((s) => !CRYPTO_MAP[s]);
  if (invalid.length > 0) {
    return apiError(`Unknown symbols: ${invalid.join(", ")}. Available: ${Object.keys(CRYPTO_MAP).join(", ")}`, 400);
  }

  try {
    const cacheKey = `crypto_${symbols.sort().join(",")}_${currency}`;
    const { data: prices, cached: wasCached, fetched_at } = await cached(
      cacheKey,
      15, // 15s cache
      async () => {
        // Try CoinGecko first (works globally)
        try {
          return await fetchCoinGeckoPrices(symbols, currency);
        } catch (cgErr) {
          console.warn("[crypto] CoinGecko failed, trying Binance:", cgErr);
          // Fallback to Binance (may fail in some regions)
          return await fetchBinancePrices(symbols);
        }
      }
    );

    const results: (PriceData & { _cached: boolean })[] = symbols.map((sym) => {
      const p = prices[sym];
      return {
        symbol: sym,
        name: CRYPTO_MAP[sym].name,
        price: p ? parseFloat(p.price.toFixed(2)) : 0,
        currency,
        change_24h: p ? parseFloat(p.change24h.toFixed(2)) : 0,
        change_percent_24h: p ? parseFloat(p.changePercent24h.toFixed(2)) : 0,
        high_24h: p ? parseFloat(p.high24h.toFixed(2)) : 0,
        low_24h: p ? parseFloat(p.low24h.toFixed(2)) : 0,
        volume_24h: p ? Math.round(p.volume24h) : 0,
        market_cap: p?.marketCap || undefined,
        source: "coingecko",
        updated_at: fetched_at,
        _cached: wasCached,
      };
    });

    return apiSuccess(results, {
      currency,
      available_symbols: Object.keys(CRYPTO_MAP),
    });
  } catch (err) {
    return apiError(`Failed to fetch crypto prices: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
