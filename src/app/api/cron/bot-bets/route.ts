export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

/**
 * Cron: Bot betting engine — runs every minute server-side.
 * Places 1 bot bet per open market per tick.
 * Optimized: batches DB operations, no inline broadcast.
 * Pages load recent bets from DB on mount.
 */

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(): number {
  const r = Math.random();
  if (r < 0.55) return randInt(1, 20);
  if (r < 0.80) return randInt(20, 50);
  if (r < 0.95) return randInt(50, 100);
  return randInt(100, 300);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get open prediction markets + bot users in parallel
    const [marketsRes, botsRes] = await Promise.all([
      supabase
        .from("prediction_markets")
        .select("id, outcomes, pool_total, house_fee_percent, freeze_at, close_at")
        .eq("status", "open"),
      supabase
        .from("users")
        .select("id, name, balance")
        .eq("is_bot", true)
        .gt("balance", 5)
        .limit(200),
    ]);

    const markets = marketsRes.data || [];
    const bots = botsRes.data || [];

    if (bots.length === 0) {
      return NextResponse.json({ ok: true, message: "No bots", bets_placed: 0 });
    }

    const now = Date.now();
    let totalBets = 0;
    let errors = 0;

    // 2. Process prediction markets — 1 bet per market, batched
    const betInserts: Record<string, unknown>[] = [];
    const marketUpdates: { id: string; outcomes: unknown[]; pool_total: number; fee: number }[] = [];
    const botBalanceUpdates: Map<string, number> = new Map();

    for (const market of markets) {
      const freezeAt = market.freeze_at ? new Date(market.freeze_at).getTime() : 0;
      const closeAt = market.close_at ? new Date(market.close_at).getTime() : 0;
      if ((freezeAt && now >= freezeAt) || (closeAt && now >= closeAt)) continue;

      const outcomes = market.outcomes || [];
      if (outcomes.length === 0) continue;

      const eligible = bots.filter((b) => Number(b.balance) >= 5);
      if (eligible.length === 0) break;

      const bot = pick(eligible);
      const amount = Math.min(randomAmount(), Math.floor(Number(bot.balance)));
      if (amount < 1) continue;

      // Pick outcome
      const sorted = [...outcomes].sort(
        (a: { pool?: number }, b: { pool?: number }) => (Number(b.pool) || 0) - (Number(a.pool) || 0)
      );
      const outcome = Math.random() < 0.6 ? sorted[0] : pick(sorted);

      const totalPool = Number(market.pool_total) || 0;
      const outcomePool = Number(outcome.pool) || 0;
      const fee = Number(market.house_fee_percent) || 0.05;
      const newTotal = totalPool + amount;
      const newOutcomePool = outcomePool + amount;
      const payoutPerUnit = newOutcomePool > 0 ? (newTotal * (1 - fee)) / newOutcomePool : 1;

      // Track bot balance locally
      bot.balance = Number(bot.balance) - amount;
      botBalanceUpdates.set(bot.id, Number(bot.balance));

      betInserts.push({
        id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: bot.id,
        market_id: market.id,
        outcome_key: outcome.key,
        outcome_label: outcome.label || outcome.key,
        amount,
        payout_at_entry: payoutPerUnit,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      const updatedOutcomes = outcomes.map((o: { key: string; pool?: number }) =>
        o.key === outcome.key ? { ...o, pool: (Number(o.pool) || 0) + amount } : o
      );
      market.outcomes = updatedOutcomes;
      market.pool_total = newTotal;
      marketUpdates.push({ id: market.id, outcomes: updatedOutcomes, pool_total: newTotal, fee });
    }

    // 3. Batch insert bets (chunks of 50)
    for (let i = 0; i < betInserts.length; i += 50) {
      const chunk = betInserts.slice(i, i + 50);
      const { error } = await supabase.from("prediction_bets").insert(chunk);
      if (error) errors++;
      else totalBets += chunk.length;
    }

    // 4. Batch update markets (parallel, chunks of 10)
    const marketChunks = [];
    for (let i = 0; i < marketUpdates.length; i += 10) {
      marketChunks.push(marketUpdates.slice(i, i + 10));
    }
    await Promise.all(marketChunks.map(async (chunk) => {
      for (const u of chunk) {
        await supabase.from("prediction_markets").update({
          outcomes: u.outcomes,
          pool_total: u.pool_total,
          distributable_pool: u.pool_total * (1 - u.fee),
          updated_at: new Date().toISOString(),
        }).eq("id", u.id);
      }
    }));

    // 5. Batch update bot balances
    await Promise.all(
      Array.from(botBalanceUpdates.entries()).map(([id, balance]) =>
        supabase.from("users").update({ balance, updated_at: new Date().toISOString() }).eq("id", id)
      )
    );

    // 6. Camera markets — 1 bet per active betting camera
    let cameraBets = 0;
    const { data: cameraMarkets } = await supabase
      .from("camera_markets")
      .select("id, phase, current_threshold, round_number")
      .eq("phase", "betting");

    if (cameraMarkets && cameraMarkets.length > 0) {
      const camPredInserts: Record<string, unknown>[] = [];
      const roundUpdates: { roundId: string; poolOver: number; poolUnder: number; totalPool: number }[] = [];

      for (const cam of cameraMarkets) {
        const eligible = bots.filter((b) => Number(b.balance) >= 5);
        if (eligible.length === 0) break;

        const roundId = `cr_${cam.id}_${cam.round_number}`;
        const { data: round } = await supabase
          .from("camera_rounds")
          .select("pool_over, pool_under, total_pool")
          .eq("id", roundId)
          .maybeSingle();
        if (!round) continue;

        const bot = pick(eligible);
        const amount = Math.min(randomAmount(), Math.floor(Number(bot.balance)));
        if (amount < 1) continue;

        const predType = Math.random() > 0.45 ? "over" : "under";
        const poolOver = Number(round.pool_over) + (predType === "over" ? amount : 0);
        const poolUnder = Number(round.pool_under) + (predType === "under" ? amount : 0);
        const totalPool = poolOver + poolUnder;
        const myPool = predType === "over" ? poolOver : poolUnder;
        const oddsAtEntry = myPool > 0 ? (totalPool * 0.95) / myPool : 1;

        bot.balance = Number(bot.balance) - amount;
        botBalanceUpdates.set(bot.id, Number(bot.balance));

        camPredInserts.push({
          id: `cpred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: bot.id,
          market_id: cam.id,
          round_id: roundId,
          prediction_type: predType,
          threshold: cam.current_threshold,
          amount_brl: amount,
          odds_at_entry: Math.round(oddsAtEntry * 100) / 100,
          status: "open",
        });

        roundUpdates.push({ roundId, poolOver, poolUnder, totalPool });
      }

      if (camPredInserts.length > 0) {
        const { error } = await supabase.from("camera_predictions").insert(camPredInserts);
        if (!error) cameraBets = camPredInserts.length;
        else errors++;
      }

      await Promise.all(roundUpdates.map((u) =>
        supabase.from("camera_rounds").update({
          pool_over: u.poolOver, pool_under: u.poolUnder, total_pool: u.totalPool,
        }).eq("id", u.roundId)
      ));

      // Update remaining bot balances from camera bets
      await Promise.all(
        Array.from(botBalanceUpdates.entries()).map(([id, balance]) =>
          supabase.from("users").update({ balance, updated_at: new Date().toISOString() }).eq("id", id)
        )
      );
    }

    totalBets += cameraBets;

    return NextResponse.json({
      ok: true,
      markets_processed: markets.length + (cameraMarkets?.length || 0),
      bets_placed: totalBets,
      camera_bets: cameraBets,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/bot-bets] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
