export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { cached } from "../../_lib/cache";
import type { StockData } from "../../_lib/types";

// Brazilian stocks and indices available via brapi.dev
const STOCK_PRESETS: Record<string, string[]> = {
  ibovespa_top10: ["PETR4", "VALE3", "ITUB4", "BBDC4", "B3SA3", "ABEV3", "WEGE3", "RENT3", "SUZB3", "ELET3"],
  banks: ["ITUB4", "BBDC4", "BBAS3", "SANB11", "BPAC11"],
  commodities: ["PETR4", "VALE3", "SUZB3", "CSAN3", "SLCE3"],
  tech: ["TOTS3", "LWSA3", "CASH3", "POSI3", "INTB3"],
  retail: ["MGLU3", "VIIA3", "AMER3", "LREN3", "PETZ3"],
};

// All valid symbols (expanded)
const VALID_SYMBOLS = new Set([
  // Indices
  "^BVSP", "IBOV",
  // Top stocks
  "PETR4", "VALE3", "ITUB4", "BBDC4", "B3SA3", "ABEV3", "WEGE3", "RENT3",
  "SUZB3", "ELET3", "BBAS3", "SANB11", "BPAC11", "TOTS3", "LWSA3",
  "MGLU3", "LREN3", "PETZ3", "CSAN3", "SLCE3", "CASH3", "POSI3",
  "INTB3", "HAPV3", "RADL3", "RAIL3", "JBSS3", "BRFS3", "EMBR3",
  "VBBR3", "ENEV3", "EQTL3", "TAEE11", "VIVT3", "CMIG4", "CPFE3",
  "GGBR4", "CSNA3", "USIM5", "GOAU4", "CPLE6", "SBSP3", "SAPR11",
  "CYRE3", "MRVE3", "EVEN3", "TRIS3", "VIIA3", "AMER3",
]);

async function fetchBrapiQuotes(symbols: string[]): Promise<StockData[]> {
  const token = process.env.BRAPI_TOKEN || "";
  const symbolStr = symbols.join(",");

  // brapi.dev - free tier: 15 req/min, no key needed for basic; token for premium
  const url = token
    ? `https://brapi.dev/api/quote/${symbolStr}?token=${token}`
    : `https://brapi.dev/api/quote/${symbolStr}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`brapi.dev error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.results) throw new Error("No results from brapi.dev");

  return json.results.map((d: Record<string, unknown>) => ({
    symbol: d.symbol as string,
    name: (d.shortName || d.longName || d.symbol) as string,
    price: d.regularMarketPrice as number,
    currency: "BRL",
    change: d.regularMarketChange as number,
    change_percent: d.regularMarketChangePercent as number,
    open: d.regularMarketOpen as number,
    high: d.regularMarketDayHigh as number,
    low: d.regularMarketDayLow as number,
    close_previous: d.regularMarketPreviousClose as number,
    volume: d.regularMarketVolume as number,
    market_cap: d.marketCap as number | undefined,
    sector: (d.sector || undefined) as string | undefined,
    source: "brapi.dev",
    updated_at: new Date().toISOString(),
  }));
}

/**
 * GET /api/v1/prices/stocks
 *
 * Query params:
 *   symbols - comma-separated tickers (default: PETR4,VALE3,ITUB4)
 *   preset  - use a preset group: ibovespa_top10, banks, commodities, tech, retail
 *
 * Example: /api/v1/prices/stocks?symbols=PETR4,VALE3
 * Example: /api/v1/prices/stocks?preset=ibovespa_top10
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const preset = searchParams.get("preset");
  const symbolsParam = searchParams.get("symbols");

  let symbols: string[];

  if (preset) {
    const presetSymbols = STOCK_PRESETS[preset];
    if (!presetSymbols) {
      return apiError(`Unknown preset: ${preset}. Available: ${Object.keys(STOCK_PRESETS).join(", ")}`, 400);
    }
    symbols = presetSymbols;
  } else {
    symbols = (symbolsParam || "PETR4,VALE3,ITUB4").split(",").map((s) => s.trim().toUpperCase());
  }

  // Validate (allow any symbol - brapi will reject unknown ones)
  if (symbols.length > 20) {
    return apiError("Max 20 symbols per request", 400);
  }

  try {
    const cacheKey = `stocks_${symbols.sort().join(",")}`;
    const { data, cached: wasCached, fetched_at } = await cached(
      cacheKey,
      60, // 1min cache — B3 doesn't need sub-second updates
      () => fetchBrapiQuotes(symbols)
    );

    return apiSuccess(data, {
      _cached: wasCached,
      fetched_at,
      presets: Object.keys(STOCK_PRESETS),
      note: "B3 market hours: 10:00-17:00 BRT (weekdays). Prices outside hours are last close.",
    });
  } catch (err) {
    return apiError(`Stock fetch failed: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
