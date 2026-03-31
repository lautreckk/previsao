export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../_lib/auth";
import { cached } from "../_lib/cache";
import type { ResolutionResult } from "../_lib/types";

/**
 * POST /api/v1/resolve
 *
 * Automatically resolves a market based on its type and parameters.
 * Fetches real data from the appropriate provider and determines the winner.
 *
 * Body:
 * {
 *   "market_id": "mkt_123",
 *   "market_type": "crypto_up_down",
 *   "params": { ... type-specific params }
 * }
 *
 * Market types:
 *   - crypto_up_down: { symbol, open_price, close_time? }
 *   - weather_threshold: { city, metric: "temperature"|"humidity", operator: ">"|"<"|">="|"<=", threshold }
 *   - stock_performance: { symbols: [...], metric: "change_percent", period: "day" }
 *   - sport_event: { match_id, stat: "corners"|"fouls"|"goals", condition: ">5" }
 *   - forex_up_down: { pair, open_price }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  let body: { market_id: string; market_type: string; params: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  if (!body.market_id || !body.market_type || !body.params) {
    return apiError("Required: market_id, market_type, params", 400);
  }

  try {
    const result = await resolveByType(body.market_id, body.market_type, body.params);
    return apiSuccess(result);
  } catch (err) {
    return apiError(`Resolution failed: ${err}`, 500, "RESOLUTION_ERROR");
  }
}

/**
 * GET /api/v1/resolve?market_type=crypto_up_down&symbol=BTC&open_price=350000
 *
 * Quick resolution check via GET (useful for testing)
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const marketType = searchParams.get("market_type");
  if (!marketType) return apiError("Required: market_type query param", 400);

  const params: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key !== "market_type") {
      // Try to parse numbers
      const num = Number(value);
      params[key] = isNaN(num) ? value : num;
    }
  }

  try {
    const result = await resolveByType("test", marketType, params);
    return apiSuccess(result);
  } catch (err) {
    return apiError(`Resolution failed: ${err}`, 500, "RESOLUTION_ERROR");
  }
}

// ---- Resolution Handlers ----

async function resolveByType(
  marketId: string,
  marketType: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  switch (marketType) {
    case "crypto_up_down":
      return resolveCryptoUpDown(marketId, params);
    case "forex_up_down":
      return resolveForexUpDown(marketId, params);
    case "weather_threshold":
      return resolveWeatherThreshold(marketId, params);
    case "stock_performance":
      return resolveStockPerformance(marketId, params);
    case "sport_event":
      return resolveSportEvent(marketId, params);
    default:
      return {
        market_id: marketId,
        resolved: false,
        winning_outcome_key: null,
        source_data: {},
        reason: `Unknown market_type: ${marketType}`,
        resolved_at: new Date().toISOString(),
      };
  }
}

// -- Crypto Sobe/Desce --
async function resolveCryptoUpDown(
  marketId: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  const symbol = (params.symbol as string) || "BTC";
  const openPrice = params.open_price as number;
  if (!openPrice) throw new Error("open_price is required");

  // CoinGecko ID map
  const cgIds: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
    XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot",
    AVAX: "avalanche-2", LINK: "chainlink", USDT: "tether",
  };
  const cgId = cgIds[symbol] || symbol.toLowerCase();

  const { data: cgData } = await cached(`resolve_crypto_${symbol}`, 10, async () => {
    // Try CoinGecko first (works globally)
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
      if (res.ok) {
        const json = await res.json();
        return { price: json[cgId]?.usd || 0, source: "coingecko" };
      }
    } catch { /* fall through */ }
    // Fallback to AwesomeAPI for BRL pairs
    try {
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${symbol}-USD`);
      if (res.ok) {
        const json = await res.json();
        const key = `${symbol}USD`;
        return { price: parseFloat(json[key]?.bid || "0"), source: "awesomeapi" };
      }
    } catch { /* fall through */ }
    throw new Error(`Could not fetch price for ${symbol}`);
  });

  const closePrice = cgData.price;
  const diff = closePrice - openPrice;

  let winningKey: string | null = null;
  let reason: string;

  if (diff > 0) {
    winningKey = "UP";
    reason = `${symbol} subiu: ${openPrice} -> ${closePrice} (+${diff.toFixed(2)})`;
  } else if (diff < 0) {
    winningKey = "DOWN";
    reason = `${symbol} desceu: ${openPrice} -> ${closePrice} (${diff.toFixed(2)})`;
  } else {
    winningKey = null;
    reason = `${symbol} ficou igual: ${openPrice} = ${closePrice}. Mercado anulado.`;
  }

  return {
    market_id: marketId,
    resolved: true,
    winning_outcome_key: winningKey,
    source_data: { symbol, open_price: openPrice, close_price: closePrice, diff, source: "binance" },
    reason,
    resolved_at: new Date().toISOString(),
  };
}

// -- Forex Sobe/Desce --
async function resolveForexUpDown(
  marketId: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  const pair = (params.pair as string) || "USD/BRL";
  const openPrice = params.open_price as number;
  if (!openPrice) throw new Error("open_price is required");

  // Use AwesomeAPI for forex
  const awesomeSymbol = pair.replace("/", "-");
  const { data } = await cached(`resolve_forex_${pair}`, 30, async () => {
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${awesomeSymbol}`);
    if (!res.ok) throw new Error(`AwesomeAPI error: ${res.status}`);
    return res.json();
  });

  const key = pair.replace("/", "").replace("-", "");
  const closePrice = parseFloat(data[key]?.bid || "0");
  const diff = closePrice - openPrice;

  let winningKey: string | null = null;
  let reason: string;

  if (diff > 0) {
    winningKey = "UP";
    reason = `${pair} subiu: ${openPrice} -> ${closePrice}`;
  } else if (diff < 0) {
    winningKey = "DOWN";
    reason = `${pair} desceu: ${openPrice} -> ${closePrice}`;
  } else {
    winningKey = null;
    reason = `${pair} ficou igual. Anulado.`;
  }

  return {
    market_id: marketId,
    resolved: true,
    winning_outcome_key: winningKey,
    source_data: { pair, open_price: openPrice, close_price: closePrice, source: "awesomeapi" },
    reason,
    resolved_at: new Date().toISOString(),
  };
}

// -- Weather Threshold (ex: "SP atinge 30°C?") --
async function resolveWeatherThreshold(
  marketId: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  const city = (params.city as string) || "sao-paulo";
  const metric = (params.metric as string) || "temperature";
  const operator = (params.operator as string) || ">";
  const threshold = params.threshold as number;

  if (threshold === undefined) throw new Error("threshold is required");

  const owKey = process.env.OPENWEATHER_API_KEY;
  if (!owKey) throw new Error("OPENWEATHER_API_KEY not configured");

  // City ID map (simplified)
  const cityIds: Record<string, number> = {
    "sao-paulo": 3448439, "rio-de-janeiro": 3451190, "brasilia": 3469058,
    "belo-horizonte": 3470127, "curitiba": 3464975, "porto-alegre": 3452925,
    "salvador": 3450554, "fortaleza": 3399415, "recife": 3390760,
    "florianopolis": 3463237, "manaus": 3663517,
  };

  const cityId = cityIds[city];
  if (!cityId) throw new Error(`Unknown city: ${city}`);

  const { data: weather } = await cached(`resolve_weather_${city}`, 300, async () => {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${owKey}&units=metric`
    );
    if (!res.ok) throw new Error(`OpenWeather error: ${res.status}`);
    return res.json();
  });

  const metricMap: Record<string, number> = {
    temperature: weather.main?.temp,
    temp_max: weather.main?.temp_max,
    temp_min: weather.main?.temp_min,
    humidity: weather.main?.humidity,
    wind_speed: weather.wind?.speed,
  };

  const actualValue = metricMap[metric];
  if (actualValue === undefined) throw new Error(`Unknown metric: ${metric}`);

  const ops: Record<string, (a: number, b: number) => boolean> = {
    ">": (a, b) => a > b,
    "<": (a, b) => a < b,
    ">=": (a, b) => a >= b,
    "<=": (a, b) => a <= b,
    "=": (a, b) => Math.abs(a - b) < 0.5,
  };

  const evaluate = ops[operator];
  if (!evaluate) throw new Error(`Unknown operator: ${operator}`);

  const result = evaluate(actualValue, threshold);

  return {
    market_id: marketId,
    resolved: true,
    winning_outcome_key: result ? "YES" : "NO",
    source_data: { city, metric, operator, threshold, actual_value: actualValue, source: "openweathermap" },
    reason: `${city} ${metric}=${actualValue} ${operator} ${threshold} => ${result ? "SIM" : "NAO"}`,
    resolved_at: new Date().toISOString(),
  };
}

// -- Stock Performance (ex: "Qual acao subiu mais em marco?") --
async function resolveStockPerformance(
  marketId: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  const symbols = (params.symbols as string[]) || ["PETR4", "VALE3", "ITUB4"];
  const metric = (params.metric as string) || "change_percent";

  const token = process.env.BRAPI_TOKEN || "";
  const url = token
    ? `https://brapi.dev/api/quote/${symbols.join(",")}?token=${token}`
    : `https://brapi.dev/api/quote/${symbols.join(",")}`;

  const { data } = await cached(`resolve_stocks_${symbols.join(",")}`, 60, async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`brapi.dev error: ${res.status}`);
    return res.json();
  });

  if (!data.results || data.results.length === 0) {
    throw new Error("No stock data returned");
  }

  // Find the winner based on metric
  const metricKey = metric === "change_percent" ? "regularMarketChangePercent" : "regularMarketChange";
  const sorted = [...data.results].sort(
    (a: Record<string, number>, b: Record<string, number>) => (b[metricKey] || 0) - (a[metricKey] || 0)
  );

  const winner = sorted[0];
  const winnerSymbol = winner.symbol as string;

  return {
    market_id: marketId,
    resolved: true,
    winning_outcome_key: winnerSymbol,
    source_data: {
      ranking: sorted.map((s: Record<string, unknown>) => ({
        symbol: s.symbol,
        change_percent: s.regularMarketChangePercent,
        price: s.regularMarketPrice,
      })),
      source: "brapi.dev",
    },
    reason: `${winnerSymbol} liderou com ${(winner[metricKey] as number)?.toFixed(2)}% de variacao`,
    resolved_at: new Date().toISOString(),
  };
}

// -- Sport Event (ex: "Mais de 5 escanteios nos primeiros 10 min?") --
async function resolveSportEvent(
  marketId: string,
  params: Record<string, unknown>
): Promise<ResolutionResult> {
  const matchId = params.match_id as string;
  const stat = (params.stat as string) || "corners"; // corners, fouls, goals
  const condition = (params.condition as string) || ">0"; // e.g. ">5", ">=3"

  if (!matchId) throw new Error("match_id is required");

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not configured");

  const { data: json } = await cached(`resolve_sport_${matchId}`, 30, async () => {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${matchId}`, {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
    return res.json();
  });

  if (!json.response || json.response.length === 0) {
    throw new Error(`Match ${matchId} not found`);
  }

  const fixture = json.response[0];
  const goals = fixture.goals as Record<string, number | null>;

  // Extract stat value
  let value = 0;
  if (stat === "goals") {
    value = (goals?.home || 0) + (goals?.away || 0);
  } else if (stat === "corners" || stat === "fouls") {
    // Would need statistics endpoint for detailed stats
    // Simplified: check if stats are in the fixture response
    const statistics = fixture.statistics as Record<string, unknown>[] | undefined;
    if (statistics && statistics.length >= 2) {
      const getStat = (team: Record<string, unknown>[], type: string) => {
        const s = team.find((s: Record<string, unknown>) => s.type === type);
        return typeof s?.value === "number" ? s.value : parseInt(String(s?.value)) || 0;
      };
      const typeMap: Record<string, string> = { corners: "Corner Kicks", fouls: "Fouls" };
      const home = (statistics[0] as Record<string, unknown>).statistics as Record<string, unknown>[];
      const away = (statistics[1] as Record<string, unknown>).statistics as Record<string, unknown>[];
      if (home && away) {
        value = getStat(home, typeMap[stat]) + getStat(away, typeMap[stat]);
      }
    }
  }

  // Parse condition (e.g. ">5", ">=3", "<10")
  const match = condition.match(/^([><=!]+)(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Invalid condition format: ${condition}`);

  const op = match[1];
  const threshold = parseFloat(match[2]);

  const ops: Record<string, (a: number, b: number) => boolean> = {
    ">": (a, b) => a > b, "<": (a, b) => a < b,
    ">=": (a, b) => a >= b, "<=": (a, b) => a <= b,
    "=": (a, b) => a === b, "!=": (a, b) => a !== b,
  };

  const evaluate = ops[op];
  if (!evaluate) throw new Error(`Unknown operator: ${op}`);

  const result = evaluate(value, threshold);

  return {
    market_id: marketId,
    resolved: true,
    winning_outcome_key: result ? "YES" : "NO",
    source_data: {
      match_id: matchId,
      stat,
      value,
      condition,
      threshold,
      home_team: (fixture.teams as Record<string, Record<string, unknown>>)?.home?.name,
      away_team: (fixture.teams as Record<string, Record<string, unknown>>)?.away?.name,
      score: `${goals?.home || 0}-${goals?.away || 0}`,
      source: "api-football",
    },
    reason: `${stat}=${value} ${op} ${threshold} => ${result ? "SIM" : "NAO"}`,
    resolved_at: new Date().toISOString(),
  };
}
