export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { createClient } from "@supabase/supabase-js";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Supported live round types
const ROUND_CONFIGS: Record<string, {
  symbol: string;
  source: "binance" | "awesome";
  binance_symbol?: string;
  awesome_symbol?: string;
  duration_seconds: number;
  betting_window_seconds: number;
  schedule: { days: number[]; start_hour: number; end_hour: number } | "24/7";
  category: string;
}> = {
  "btc-5min": {
    symbol: "BTC",
    source: "binance",
    binance_symbol: "BTCUSDT",
    duration_seconds: 300,
    betting_window_seconds: 150,
    schedule: "24/7",
    category: "crypto",
  },
  "eth-5min": {
    symbol: "ETH",
    source: "binance",
    binance_symbol: "ETHUSDT",
    duration_seconds: 300,
    betting_window_seconds: 150,
    schedule: "24/7",
    category: "crypto",
  },
  "sol-5min": {
    symbol: "SOL",
    source: "binance",
    binance_symbol: "SOLUSDT",
    duration_seconds: 300,
    betting_window_seconds: 150,
    schedule: "24/7",
    category: "crypto",
  },
  "usd-brl-daily": {
    symbol: "USD/BRL",
    source: "binance",
    binance_symbol: "USDTBRL",
    duration_seconds: 28200, // 09:10 to 17:00 = 7h50min
    betting_window_seconds: 14400, // first 4 hours
    schedule: { days: [1, 2, 3, 4, 5], start_hour: 9, end_hour: 17 },
    category: "economy",
  },
  "petr4-daily": {
    symbol: "PETR4",
    source: "binance", // will use brapi for actual price
    duration_seconds: 25200, // 10:00 to 17:00
    betting_window_seconds: 7200,
    schedule: { days: [1, 2, 3, 4, 5], start_hour: 10, end_hour: 17 },
    category: "economy",
  },
};

// CoinGecko IDs for live round symbols
const CG_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana",
};

async function fetchCurrentPrice(config: typeof ROUND_CONFIGS[string]): Promise<number> {
  const cgId = CG_IDS[config.symbol];

  // Try CoinGecko first (works globally, no region block)
  if (cgId) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
      if (res.ok) {
        const json = await res.json();
        const price = json[cgId]?.usd;
        if (price) return price;
      }
    } catch { /* fall through */ }
  }

  // Try AwesomeAPI for forex pairs
  try {
    const awesomeSymbol = config.symbol.includes("/")
      ? config.symbol.replace("/", "-")
      : `${config.symbol}-USD`;
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${awesomeSymbol}`);
    if (res.ok) {
      const json = await res.json();
      const key = awesomeSymbol.replace("-", "");
      if (json[key]?.bid) return parseFloat(json[key].bid);
    }
  } catch { /* fall through */ }

  // Last resort: Binance (may fail in some Vercel regions)
  if (config.binance_symbol) {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${config.binance_symbol}`);
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.price);
    }
  }

  throw new Error(`No price available for ${config.symbol}`);
}

function isWithinSchedule(config: typeof ROUND_CONFIGS[string]): boolean {
  if (config.schedule === "24/7") return true;
  const now = new Date();
  const spHour = parseInt(now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  const spDay = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", weekday: "narrow" }).length > 0
    ? String(new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay())
    : "0");
  return config.schedule.days.includes(spDay) && spHour >= config.schedule.start_hour && spHour < config.schedule.end_hour;
}

/**
 * GET /api/v1/live/rounds
 *
 * Lists all active live rounds with current status
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market"); // e.g. "btc-5min"

  const supabase = sb();

  if (market) {
    // Get specific market's current round
    const { data: round } = await supabase
      .from("live_rounds")
      .select("*")
      .eq("market_key", market)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return apiSuccess(round, { market_config: ROUND_CONFIGS[market] });
  }

  // Get all active rounds
  const { data: rounds } = await supabase
    .from("live_rounds")
    .select("*")
    .in("status", ["betting", "observation", "waiting"])
    .order("created_at", { ascending: false });

  return apiSuccess(rounds || [], { available_markets: Object.keys(ROUND_CONFIGS) });
}

/**
 * POST /api/v1/live/rounds
 *
 * Create/advance a live round. Called by cron every minute.
 *
 * Body: { "action": "tick" } — processes all markets
 * Body: { "action": "create", "market": "btc-5min" } — force create new round
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  let body: { action: string; market?: string };
  try {
    body = await request.json();
  } catch {
    body = { action: "tick" };
  }

  const supabase = sb();
  const results: Record<string, unknown>[] = [];

  if (body.action === "tick") {
    // Process all markets
    for (const [marketKey, config] of Object.entries(ROUND_CONFIGS)) {
      try {
        const result = await processMarketTick(supabase, marketKey, config);
        results.push({ market: marketKey, ...result });
      } catch (err) {
        results.push({ market: marketKey, error: String(err) });
      }
    }
    return apiSuccess(results, { action: "tick" });
  }

  if (body.action === "create" && body.market) {
    const config = ROUND_CONFIGS[body.market];
    if (!config) return apiError(`Unknown market: ${body.market}`, 400);

    const result = await createNewRound(supabase, body.market, config);
    return apiSuccess(result, { action: "create", market: body.market });
  }

  return apiError("action must be 'tick' or 'create'", 400);
}

async function processMarketTick(
  supabase: ReturnType<typeof sb>,
  marketKey: string,
  config: typeof ROUND_CONFIGS[string]
) {
  // Check schedule
  if (!isWithinSchedule(config)) {
    return { status: "outside_schedule", skipped: true };
  }

  // Get current active round
  const { data: current } = await supabase
    .from("live_rounds")
    .select("*")
    .eq("market_key", marketKey)
    .in("status", ["betting", "observation"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const now = Date.now();

  if (!current) {
    // No active round — create one
    return createNewRound(supabase, marketKey, config);
  }

  const roundEnd = new Date(current.ends_at).getTime();
  const bettingEnd = new Date(current.betting_ends_at).getTime();

  // Check if betting phase should end
  if (current.status === "betting" && now >= bettingEnd) {
    await supabase
      .from("live_rounds")
      .update({ status: "observation" })
      .eq("id", current.id);
    return { status: "transitioned_to_observation", round_id: current.id };
  }

  // Check if round should resolve
  if (now >= roundEnd) {
    return resolveRound(supabase, current, config);
  }

  return { status: current.status, round_id: current.id, time_remaining_ms: roundEnd - now };
}

async function createNewRound(
  supabase: ReturnType<typeof sb>,
  marketKey: string,
  config: typeof ROUND_CONFIGS[string]
) {
  const openPrice = await fetchCurrentPrice(config);
  const now = new Date();
  const endsAt = new Date(now.getTime() + config.duration_seconds * 1000);
  const bettingEndsAt = new Date(now.getTime() + config.betting_window_seconds * 1000);

  const { data: round, error } = await supabase
    .from("live_rounds")
    .insert({
      market_key: marketKey,
      symbol: config.symbol,
      category: config.category,
      open_price: openPrice,
      close_price: null,
      status: "betting",
      pool_up: 0,
      pool_down: 0,
      pool_total: 0,
      round_number: Date.now(), // unique round identifier
      started_at: now.toISOString(),
      betting_ends_at: bettingEndsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_seconds: config.duration_seconds,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create round: ${error.message}`);
  return { status: "created", round };
}

async function resolveRound(
  supabase: ReturnType<typeof sb>,
  round: Record<string, unknown>,
  config: typeof ROUND_CONFIGS[string]
) {
  const closePrice = await fetchCurrentPrice(config);
  const openPrice = round.open_price as number;
  const diff = closePrice - openPrice;

  let winningOutcome: "UP" | "DOWN" | null = null;
  if (diff > 0) winningOutcome = "UP";
  else if (diff < 0) winningOutcome = "DOWN";
  // diff === 0 => anulado (null)

  const poolUp = (round.pool_up as number) || 0;
  const poolDown = (round.pool_down as number) || 0;
  const poolTotal = poolUp + poolDown;
  const houseFee = poolTotal * 0.05;
  const distributable = poolTotal - houseFee;

  let payoutPerUnit = 0;
  if (winningOutcome === "UP" && poolUp > 0) payoutPerUnit = distributable / poolUp;
  else if (winningOutcome === "DOWN" && poolDown > 0) payoutPerUnit = distributable / poolDown;

  // Update round
  await supabase
    .from("live_rounds")
    .update({
      status: "resolved",
      close_price: closePrice,
      winning_outcome: winningOutcome,
      payout_per_unit: payoutPerUnit,
      house_fee: houseFee,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", round.id);

  // Pay winners
  if (winningOutcome && poolTotal > 0) {
    const outcomeCol = winningOutcome === "UP" ? "UP" : "DOWN";
    const { data: bets } = await supabase
      .from("live_bets")
      .select("*")
      .eq("round_id", round.id)
      .eq("outcome", outcomeCol)
      .eq("status", "pending");

    if (bets) {
      for (const bet of bets) {
        const payout = (bet.amount as number) * payoutPerUnit;
        await supabase.from("live_bets").update({ status: "won", payout }).eq("id", bet.id);
        // Credit user balance
        await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: payout });
        // Ledger entry
        await supabase.from("ledger").insert({
          user_id: bet.user_id,
          type: "bet_won",
          amount: payout,
          balance_after: 0, // will be set by trigger
          reference_id: bet.id,
          description: `Live ${config.symbol}: ${winningOutcome} (${payoutPerUnit.toFixed(2)}x)`,
        });
      }
    }

    // Mark losers
    const losingOutcome = winningOutcome === "UP" ? "DOWN" : "UP";
    await supabase
      .from("live_bets")
      .update({ status: "lost", payout: 0 })
      .eq("round_id", round.id)
      .eq("outcome", losingOutcome)
      .eq("status", "pending");
  } else if (!winningOutcome) {
    // Refund all on tie
    const { data: allBets } = await supabase
      .from("live_bets")
      .select("*")
      .eq("round_id", round.id)
      .eq("status", "pending");

    if (allBets) {
      for (const bet of allBets) {
        await supabase.from("live_bets").update({ status: "refunded", payout: bet.amount }).eq("id", bet.id);
        await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: bet.amount });
      }
    }
  }

  // Create next round immediately
  const nextRound = await createNewRound(supabase, round.market_key as string, config);

  return {
    status: "resolved",
    round_id: round.id,
    open_price: openPrice,
    close_price: closePrice,
    winning_outcome: winningOutcome,
    payout_per_unit: payoutPerUnit,
    next_round: nextRound,
  };
}
