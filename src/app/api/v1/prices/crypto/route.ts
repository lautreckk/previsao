export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { cached } from "../../_lib/cache";
import type { PriceData } from "../../_lib/types";

// Binance symbol mapping
const CRYPTO_MAP: Record<string, { binance: string; name: string }> = {
  BTC: { binance: "BTCUSDT", name: "Bitcoin" },
  ETH: { binance: "ETHUSDT", name: "Ethereum" },
  SOL: { binance: "SOLUSDT", name: "Solana" },
  BNB: { binance: "BNBUSDT", name: "Binance Coin" },
  XRP: { binance: "XRPUSDT", name: "Ripple" },
  ADA: { binance: "ADAUSDT", name: "Cardano" },
  DOGE: { binance: "DOGEUSDT", name: "Dogecoin" },
  DOT: { binance: "DOTUSDT", name: "Polkadot" },
  AVAX: { binance: "AVAXUSDT", name: "Avalanche" },
  MATIC: { binance: "MATICUSDT", name: "Polygon" },
  LINK: { binance: "LINKUSDT", name: "Chainlink" },
  UNI: { binance: "UNIUSDT", name: "Uniswap" },
  SHIB: { binance: "SHIBUSDT", name: "Shiba Inu" },
  LTC: { binance: "LTCUSDT", name: "Litecoin" },
  NEAR: { binance: "NEARUSDT", name: "NEAR Protocol" },
};

// USD/BRL rate for conversion
async function getUsdBrlRate(): Promise<number> {
  const { data } = await cached("usd_brl_rate", 60, async () => {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL");
    if (!res.ok) return 5.5; // fallback
    const json = await res.json();
    return parseFloat(json.price);
  });
  return data;
}

async function fetchBinanceTicker(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance error for ${symbol}: ${res.status}`);
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

/**
 * GET /api/v1/prices/crypto
 *
 * Query params:
 *   symbols  - comma-separated (default: BTC,ETH,SOL)
 *   currency - BRL or USD (default: BRL)
 *
 * Example: /api/v1/prices/crypto?symbols=BTC,ETH,SOL&currency=BRL
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") || "BTC,ETH,SOL";
  const currency = (searchParams.get("currency") || "BRL").toUpperCase();
  const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

  // Validate symbols
  const invalid = symbols.filter((s) => !CRYPTO_MAP[s]);
  if (invalid.length > 0) {
    return apiError(`Unknown symbols: ${invalid.join(", ")}. Available: ${Object.keys(CRYPTO_MAP).join(", ")}`, 400);
  }

  try {
    const usdBrl = currency === "BRL" ? await getUsdBrlRate() : 1;

    const results = await Promise.all(
      symbols.map(async (sym) => {
        const config = CRYPTO_MAP[sym];
        const { data: ticker, cached: wasCached, fetched_at } = await cached(
          `crypto_${sym}`,
          10, // 10s cache
          () => fetchBinanceTicker(config.binance)
        );

        const price: PriceData = {
          symbol: sym,
          name: config.name,
          price: parseFloat((ticker.price * usdBrl).toFixed(2)),
          currency,
          change_24h: parseFloat((ticker.change * usdBrl).toFixed(2)),
          change_percent_24h: parseFloat(ticker.changePercent.toFixed(2)),
          high_24h: parseFloat((ticker.high * usdBrl).toFixed(2)),
          low_24h: parseFloat((ticker.low * usdBrl).toFixed(2)),
          volume_24h: parseFloat((ticker.volume * usdBrl).toFixed(0)),
          source: "binance",
          updated_at: fetched_at,
        };

        return { ...price, _cached: wasCached };
      })
    );

    return apiSuccess(results, {
      currency,
      usd_brl_rate: currency === "BRL" ? usdBrl : undefined,
      available_symbols: Object.keys(CRYPTO_MAP),
    });
  } catch (err) {
    return apiError(`Failed to fetch crypto prices: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
