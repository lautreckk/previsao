export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateUserStats } from "@/lib/update-user-stats";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// CoinGecko IDs
const CG_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };

// Market configs
const ROUND_CONFIGS: Record<string, {
  symbol: string; category: string; duration: number; bettingWindow: number; schedule: "24/7" | { days: number[]; startH: number; endH: number };
}> = {
  "btc-5min": { symbol: "BTC", category: "crypto", duration: 300, bettingWindow: 150, schedule: "24/7" },
  "eth-5min": { symbol: "ETH", category: "crypto", duration: 300, bettingWindow: 150, schedule: "24/7" },
  "sol-5min": { symbol: "SOL", category: "crypto", duration: 300, bettingWindow: 150, schedule: "24/7" },
};

const BINANCE_SYMBOLS: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT" };

async function getPrice(symbol: string): Promise<number> {
  // Source 1: CoinGecko
  const cgId = CG_IDS[symbol];
  if (cgId) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
      if (res.ok) { const d = await res.json(); if (d[cgId]?.usd) return d[cgId].usd; }
    } catch { /* fall through */ }
  }
  // Source 2: AwesomeAPI
  try {
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${symbol}-USD`);
    if (res.ok) { const d = await res.json(); const price = parseFloat(d[`${symbol}USD`]?.bid || "0"); if (price > 0) return price; }
  } catch { /* fall through */ }
  // Source 3: Binance
  const binanceSymbol = BINANCE_SYMBOLS[symbol];
  if (binanceSymbol) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (res.ok) { const d = await res.json(); const price = parseFloat(d.price || "0"); if (price > 0) return price; }
    } catch { /* fall through */ }
  }
  return 0;
}

/**
 * Cron: tick live rounds every minute (direct DB, no HTTP self-call)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = sb();
  const results: Record<string, unknown>[] = [];
  const now = Date.now();

  for (const [marketKey, config] of Object.entries(ROUND_CONFIGS)) {
    try {
      // Check schedule
      if (config.schedule !== "24/7") {
        const h = parseInt(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
        const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
        if (!config.schedule.days.includes(d) || h < config.schedule.startH || h >= config.schedule.endH) {
          results.push({ market: marketKey, status: "outside_schedule" });
          continue;
        }
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

      if (!current) {
        // Create new round
        const price = await getPrice(config.symbol);
        if (!price) { results.push({ market: marketKey, error: "no_price" }); continue; }

        const nowDate = new Date();
        const { data: newRound } = await supabase.from("live_rounds").insert({
          market_key: marketKey,
          symbol: config.symbol,
          category: config.category,
          open_price: price,
          status: "betting",
          pool_up: 0, pool_down: 0, pool_total: 0,
          round_number: now,
          started_at: nowDate.toISOString(),
          betting_ends_at: new Date(now + config.bettingWindow * 1000).toISOString(),
          ends_at: new Date(now + config.duration * 1000).toISOString(),
          duration_seconds: config.duration,
        }).select().single();

        results.push({ market: marketKey, status: "created", round_id: newRound?.id });
        continue;
      }

      const bettingEnd = new Date(current.betting_ends_at).getTime();
      const roundEnd = new Date(current.ends_at).getTime();

      // Transition betting → observation
      if (current.status === "betting" && now >= bettingEnd) {
        await supabase.from("live_rounds").update({ status: "observation" }).eq("id", current.id);
        results.push({ market: marketKey, status: "to_observation", round_id: current.id });
        continue;
      }

      // Resolve round
      if (now >= roundEnd) {
        const closePrice = await getPrice(config.symbol);
        const openPrice = current.open_price as number;
        const diff = closePrice - openPrice;
        let winner: "UP" | "DOWN" | null = null;
        if (diff > 0) winner = "UP";
        else if (diff < 0) winner = "DOWN";

        const poolUp = (current.pool_up as number) || 0;
        const poolDown = (current.pool_down as number) || 0;
        const poolTotal = poolUp + poolDown;
        const houseFee = poolTotal * 0.05;
        const distributable = poolTotal - houseFee;
        let payoutPerUnit = 0;
        if (winner === "UP" && poolUp > 0) payoutPerUnit = distributable / poolUp;
        else if (winner === "DOWN" && poolDown > 0) payoutPerUnit = distributable / poolDown;

        await supabase.from("live_rounds").update({
          status: "resolved", close_price: closePrice, winning_outcome: winner,
          payout_per_unit: payoutPerUnit, house_fee: houseFee, resolved_at: new Date().toISOString(),
        }).eq("id", current.id);

        // Pay winners
        if (winner && poolTotal > 0) {
          const { data: bets } = await supabase.from("live_bets").select("*")
            .eq("round_id", current.id).eq("outcome", winner).eq("status", "pending");
          if (bets) {
            for (const bet of bets) {
              const payout = (bet.amount as number) * payoutPerUnit;
              await supabase.from("live_bets").update({ status: "won", payout }).eq("id", bet.id);
              updateUserStats(supabase, bet.user_id, true, payout, bet.amount as number);
              let credited = false;
              for (let attempt = 0; attempt < 3 && !credited; attempt++) {
                const { error: rpcErr } = await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: payout });
                if (!rpcErr) { credited = true; } else if (attempt === 2) {
                  console.error(`[live-rounds] CRITICAL: Failed to credit ${payout} to user ${bet.user_id} bet ${bet.id}:`, rpcErr.message);
                  await supabase.from("live_bets").update({ status: "pending", payout: 0 }).eq("id", bet.id);
                }
              }
              if (credited) {
                const { data: userRow } = await supabase.from("users").select("balance").eq("id", bet.user_id).maybeSingle();
                await supabase.from("ledger").insert({
                  id: `ldg_live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  user_id: bet.user_id, type: "bet_won", amount: payout,
                  balance_after: Number(userRow?.balance ?? 0), reference_id: bet.id,
                  description: `Live ${config.symbol} ${winner}: ${openPrice}→${closePrice} (${payoutPerUnit.toFixed(2)}x)`,
                });
              }
            }
          }
          const loser = winner === "UP" ? "DOWN" : "UP";
          const { data: loserBets } = await supabase.from("live_bets").select("user_id")
            .eq("round_id", current.id).eq("outcome", loser).eq("status", "pending");
          await supabase.from("live_bets").update({ status: "lost", payout: 0 })
            .eq("round_id", current.id).eq("outcome", loser).eq("status", "pending");
          if (loserBets) {
            for (const lb of loserBets) { updateUserStats(supabase, lb.user_id, false, 0); }
          }
        }

        // Broadcast result
        try {
          const ch = supabase.channel(`live-${marketKey}`);
          await ch.send({ type: "broadcast", event: "round.resolved", payload: {
            round_id: current.id, winner, payoutPerUnit, open_price: openPrice, close_price: closePrice,
          }});
          await supabase.removeChannel(ch);
        } catch { /* non-blocking */ }

        // Create next round immediately
        const newPrice = closePrice;
        const newNow = new Date();
        const { data: nextRound } = await supabase.from("live_rounds").insert({
          market_key: marketKey, symbol: config.symbol, category: config.category,
          open_price: newPrice, status: "betting", pool_up: 0, pool_down: 0, pool_total: 0,
          round_number: Date.now(),
          started_at: newNow.toISOString(),
          betting_ends_at: new Date(Date.now() + config.bettingWindow * 1000).toISOString(),
          ends_at: new Date(Date.now() + config.duration * 1000).toISOString(),
          duration_seconds: config.duration,
        }).select().single();

        // Broadcast new round
        try {
          const ch2 = supabase.channel(`live-${marketKey}`);
          await ch2.send({ type: "broadcast", event: "round.new", payload: {
            round_id: nextRound?.id, open_price: newPrice, symbol: config.symbol,
            betting_ends_at: nextRound?.betting_ends_at, ends_at: nextRound?.ends_at,
          }});
          await supabase.removeChannel(ch2);
        } catch { /* non-blocking */ }

        results.push({ market: marketKey, status: "resolved_and_new", winner, payoutPerUnit,
          old_round: current.id, new_round: nextRound?.id });
        continue;
      }

      results.push({ market: marketKey, status: current.status, time_left: Math.round((roundEnd - now) / 1000) });
    } catch (err) {
      results.push({ market: marketKey, error: String(err) });
    }
  }

  // Process scheduled market jobs (close + resolve prediction & camera markets)
  let jobResults: Record<string, unknown> = {};
  try {
    const { processMarketJobs } = await import("../../v1/auto-markets/engine");
    jobResults = await processMarketJobs();
  } catch (err) {
    jobResults = { error: String(err) };
  }

  return NextResponse.json({ ok: true, results, jobs: jobResults, timestamp: new Date().toISOString() });
}
