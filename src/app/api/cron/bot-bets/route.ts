export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

/**
 * Cron: Bot betting engine — runs every minute server-side.
 * Places 1-3 bot bets per open market so users see activity immediately.
 * Bots are real users with is_bot=true and balance > 0.
 */

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(): number {
  const r = Math.random();
  if (r < 0.55) return randInt(1, 20);        // 55%: tiny bets
  if (r < 0.80) return randInt(20, 50);        // 25%: small bets
  if (r < 0.95) return randInt(50, 100);       // 15%: medium bets
  return randInt(100, 300);                     // 5%: big bets
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get all open prediction markets
    const { data: markets } = await supabase
      .from("prediction_markets")
      .select("id, outcomes, pool_total, house_fee_percent, freeze_at, close_at, status")
      .eq("status", "open");

    if (!markets || markets.length === 0) {
      return NextResponse.json({ ok: true, message: "No open markets", bets_placed: 0 });
    }

    // 2. Get bot users with balance
    const { data: bots } = await supabase
      .from("users")
      .select("id, name, balance, total_predictions, total_wagered")
      .eq("is_bot", true)
      .gt("balance", 5)
      .limit(200);

    if (!bots || bots.length === 0) {
      return NextResponse.json({ ok: true, message: "No bots available", bets_placed: 0 });
    }

    const now = Date.now();
    let totalBets = 0;
    let errors = 0;

    // 3. For each open market, place 1-3 bot bets
    for (const market of markets) {
      // Skip frozen/expired markets
      const freezeAt = market.freeze_at ? new Date(market.freeze_at).getTime() : 0;
      const closeAt = market.close_at ? new Date(market.close_at).getTime() : 0;
      if ((freezeAt && now >= freezeAt) || (closeAt && now >= closeAt)) continue;

      const outcomes = market.outcomes || [];
      if (outcomes.length === 0) continue;

      // 1-3 bets per market per tick
      const betCount = randInt(1, 3);

      for (let i = 0; i < betCount; i++) {
        // Pick random bot with enough balance
        const eligibleBots = bots.filter((b) => Number(b.balance) >= 5);
        if (eligibleBots.length === 0) break;

        const bot = pick(eligibleBots);
        const amount = Math.min(randomAmount(), Math.floor(Number(bot.balance)));
        if (amount < 1) continue;

        // Pick outcome — weighted toward favorite (higher pool)
        const sorted = [...outcomes].sort(
          (a: { pool?: number }, b: { pool?: number }) => (Number(b.pool) || 0) - (Number(a.pool) || 0)
        );
        const outcome = Math.random() < 0.6 ? sorted[0] : pick(sorted);

        // Calculate payout
        const totalPool = Number(market.pool_total) || 0;
        const outcomePool = Number(outcome.pool) || 0;
        const fee = Number(market.house_fee_percent) || 0.05;
        const newTotal = totalPool + amount;
        const newOutcomePool = outcomePool + amount;
        const payoutPerUnit = newOutcomePool > 0 ? (newTotal * (1 - fee)) / newOutcomePool : 1;

        // Deduct balance
        const newBalance = Number(bot.balance) - amount;
        const newPredictions = (Number(bot.total_predictions) || 0) + 1;
        const newWagered = (Number(bot.total_wagered) || 0) + amount;
        const level = newPredictions >= 500 ? 8 : newPredictions >= 200 ? 6 : newPredictions >= 50 ? 4 : newPredictions >= 10 ? 2 : 1;

        const { error: balErr } = await supabase.from("users").update({
          balance: newBalance,
          total_predictions: newPredictions,
          total_wagered: newWagered,
          level,
          updated_at: new Date().toISOString(),
        }).eq("id", bot.id);

        if (balErr) { errors++; continue; }

        // Update local ref so same bot doesn't overspend this tick
        bot.balance = newBalance;
        bot.total_predictions = newPredictions;
        bot.total_wagered = newWagered;

        // Create bet
        const betId = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const { error: betErr } = await supabase.from("prediction_bets").insert({
          id: betId,
          user_id: bot.id,
          market_id: market.id,
          outcome_key: outcome.key,
          outcome_label: outcome.label || outcome.key,
          amount,
          payout_at_entry: payoutPerUnit,
          status: "pending",
          created_at: new Date().toISOString(),
        });

        if (betErr) { errors++; continue; }

        // Update market pool
        const updatedOutcomes = outcomes.map((o: { key: string; pool?: number }) =>
          o.key === outcome.key ? { ...o, pool: (Number(o.pool) || 0) + amount } : o
        );
        await supabase.from("prediction_markets").update({
          outcomes: updatedOutcomes,
          pool_total: newTotal,
          distributable_pool: newTotal * (1 - fee),
          updated_at: new Date().toISOString(),
        }).eq("id", market.id);

        // Update local market ref
        market.pool_total = newTotal;
        market.outcomes = updatedOutcomes;

        totalBets++;
      }
    }

    // 4. Camera markets — place over/under bets during betting phase
    let cameraBets = 0;
    const { data: cameraMarkets } = await supabase
      .from("camera_markets")
      .select("id, phase, current_threshold, round_number")
      .eq("phase", "betting");

    if (cameraMarkets && cameraMarkets.length > 0) {
      for (const cam of cameraMarkets) {
        const roundId = `cr_${cam.id}_${cam.round_number}`;
        const { data: round } = await supabase
          .from("camera_rounds")
          .select("pool_over, pool_under, total_pool")
          .eq("id", roundId)
          .maybeSingle();

        if (!round) continue;

        const camBetCount = randInt(1, 3);
        for (let i = 0; i < camBetCount; i++) {
          const eligibleBots = bots.filter((b) => Number(b.balance) >= 5);
          if (eligibleBots.length === 0) break;

          const bot = pick(eligibleBots);
          const amount = Math.min(randomAmount(), Math.floor(Number(bot.balance)));
          if (amount < 1) continue;

          const predType = Math.random() > 0.45 ? "over" : "under";
          const poolOver = Number(round.pool_over) + (predType === "over" ? amount : 0);
          const poolUnder = Number(round.pool_under) + (predType === "under" ? amount : 0);
          const totalPool = poolOver + poolUnder;
          const myPool = predType === "over" ? poolOver : poolUnder;
          const oddsAtEntry = myPool > 0 ? (totalPool * 0.95) / myPool : 1;

          // Deduct balance
          const newBalance = Number(bot.balance) - amount;
          await supabase.from("users").update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          }).eq("id", bot.id);
          bot.balance = newBalance;

          // Insert prediction
          const predId = `cpred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const { error: predErr } = await supabase.from("camera_predictions").insert({
            id: predId,
            user_id: bot.id,
            market_id: cam.id,
            round_id: roundId,
            prediction_type: predType,
            threshold: cam.current_threshold,
            amount_brl: amount,
            odds_at_entry: Math.round(oddsAtEntry * 100) / 100,
            status: "open",
          });

          if (predErr) { errors++; continue; }

          // Update round pools
          await supabase.from("camera_rounds").update({
            pool_over: poolOver,
            pool_under: poolUnder,
            total_pool: totalPool,
          }).eq("id", roundId);

          round.pool_over = poolOver;
          round.pool_under = poolUnder;
          round.total_pool = totalPool;

          cameraBets++;
        }
      }
    }

    totalBets += cameraBets;

    return NextResponse.json({
      ok: true,
      markets_processed: (markets?.length || 0) + (cameraMarkets?.length || 0),
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
