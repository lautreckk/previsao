export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateBet } from "@/lib/engines/risk-engine";
import type { PredictionMarket, Bet } from "@/lib/engines/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { market_id, outcome_key, outcome_label, amount, user_id } = await request.json();

    if (!market_id || !outcome_key || !amount || !user_id) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Valor minimo: R$ 1" }, { status: 400 });
    }

    // Get user balance
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select("balance, total_predictions, total_wagered")
      .eq("id", user_id)
      .single();

    if (userErr || !userData) {
      return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
    }
    if (Number(userData.balance) < amount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Get market
    const { data: market, error: mktErr } = await supabase
      .from("prediction_markets")
      .select("*")
      .eq("id", market_id)
      .single();

    if (mktErr || !market) {
      return NextResponse.json({ error: "Mercado nao encontrado" }, { status: 404 });
    }
    if (market.status !== "open") {
      return NextResponse.json({ error: "Mercado nao esta aberto" }, { status: 400 });
    }

    // Risk engine validation
    const { data: userBetsRaw } = await supabase
      .from("prediction_bets")
      .select("*")
      .eq("market_id", market_id)
      .eq("user_id", user_id)
      .eq("status", "pending");

    const riskMarket: PredictionMarket = {
      ...market,
      outcomes: market.outcomes || [],
      pool_total: Number(market.pool_total) || 0,
      house_fee_percent: Number(market.house_fee_percent) || 0.05,
      min_bet: Number(market.min_bet) || 1,
      max_bet: Number(market.max_bet) || 10000,
      max_liability: Number(market.max_liability) || 500000,
      freeze_at: new Date(market.freeze_at).getTime(),
      close_at: new Date(market.close_at).getTime(),
    } as PredictionMarket;

    const userBets = (userBetsRaw || []).map((b: Record<string, unknown>) => ({
      ...b,
      amount: Number(b.amount) || 0,
    })) as Bet[];

    const riskCheck = validateBet(
      riskMarket, user_id, outcome_key, amount,
      Number(userData.balance), userBets
    );

    if (!riskCheck.allowed) {
      return NextResponse.json({ error: riskCheck.reason }, { status: 400 });
    }

    // Calculate payout
    const outcomes = market.outcomes || [];
    const totalPool = Number(market.pool_total) || 0;
    const outcomeObj = outcomes.find((o: { key: string }) => o.key === outcome_key);
    const outcomePool = outcomeObj ? Number(outcomeObj.pool) || 0 : 0;
    const newTotal = totalPool + amount;
    const newOutcomePool = outcomePool + amount;
    const fee = Number(market.house_fee_percent) || 0.05;
    const payoutPerUnit = newOutcomePool > 0 ? (newTotal * (1 - fee)) / newOutcomePool : 1;

    // Deduct balance + update prediction stats
    const newBalance = Number(userData.balance) - amount;
    const newPredictions = (Number(userData.total_predictions) || 0) + 1;
    const newWagered = (Number(userData.total_wagered) || 0) + amount;
    // Recalculate level
    const level = newPredictions >= 500 ? 8 : newPredictions >= 350 ? 7 : newPredictions >= 200 ? 6 : newPredictions >= 100 ? 5 : newPredictions >= 50 ? 4 : newPredictions >= 30 ? 3 : newPredictions >= 10 ? 2 : 1;
    await supabase.from("users").update({
      balance: newBalance,
      total_predictions: newPredictions,
      total_wagered: newWagered,
      level,
      updated_at: new Date().toISOString(),
    }).eq("id", user_id);

    // Fetch current price as entry_price (for chart marker)
    let entryPrice: number | null = null;
    try {
      const config = market.source_config?.custom_params;
      const mktType = config?.market_type as string | undefined;
      if (mktType === "crypto_up_down" || mktType === "forex_up_down") {
        entryPrice = config?.params?.open_price as number || null;
        // Try to get live price
        const sym = (config?.params?.symbol as string) || "";
        const cgIds: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin" };
        const cgId = cgIds[sym];
        if (cgId) {
          try {
            const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
            if (r.ok) { const j = await r.json(); const p = j[cgId]?.usd; if (p) entryPrice = p; }
          } catch { /* use open_price */ }
        } else if (sym === "USD-BRL" || (config?.params?.pair as string)?.includes("USD")) {
          try {
            const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
            if (r.ok) { const j = await r.json(); const p = parseFloat(j.USDBRL?.bid || "0"); if (p) entryPrice = p; }
          } catch { /* use open_price */ }
        }
      }
    } catch { /* non-blocking */ }

    // Create bet
    const betId = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from("prediction_bets").insert({
      id: betId,
      user_id,
      market_id,
      outcome_key,
      outcome_label: outcome_label || outcome_key,
      amount,
      payout_at_entry: payoutPerUnit,
      entry_price: entryPrice,
      status: "pending",
    });

    // Update market pools
    const userAlreadyBetOnOutcome = (userBetsRaw || []).some(
      (b: Record<string, unknown>) => b.outcome_key === outcome_key
    );
    const updatedOutcomes = outcomes.map((o: { key: string; pool: number; bet_count: number; unique_users: number; payout_per_unit: number }) => {
      if (o.key === outcome_key) {
        const newPool = (Number(o.pool) || 0) + amount;
        return {
          ...o,
          pool: newPool,
          bet_count: (o.bet_count || 0) + 1,
          unique_users: (o.unique_users || 0) + (userAlreadyBetOnOutcome ? 0 : 1),
          payout_per_unit: newPool > 0 ? ((newTotal) * (1 - fee)) / newPool : 0,
        };
      }
      // Recalculate payout for other outcomes too
      const oPool = Number(o.pool) || 0;
      return {
        ...o,
        payout_per_unit: oPool > 0 ? ((newTotal) * (1 - fee)) / oPool : 0,
      };
    });

    await supabase
      .from("prediction_markets")
      .update({
        outcomes: updatedOutcomes,
        pool_total: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", market_id);

    // Ledger entry
    await supabase.from("ledger").insert({
      id: `ldg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id,
      type: "bet_placed",
      amount: -amount,
      balance_after: newBalance,
      reference_id: betId,
      description: `Previsao: ${outcome_label || outcome_key} em ${market.title}`,
    });

    // Get user name for broadcast
    let userName = "Alguem";
    try {
      const { data: uData } = await supabase.from("users").select("name").eq("id", user_id).single();
      if (uData?.name) userName = uData.name;
    } catch { /* non-blocking */ }

    // Broadcast odds update + bet placed via Supabase Realtime
    try {
      const broadcastChannel = supabase.channel(`market-${market_id}`);
      await broadcastChannel.send({
        type: "broadcast",
        event: "odds.update",
        payload: {
          marketId: market_id,
          outcomes: updatedOutcomes,
          pool_total: newTotal,
          _ts: Date.now(),
        },
      });
      // Broadcast new bet for live activity feed
      const outcomeColor = outcomeObj?.color || "#F5A623";
      await broadcastChannel.send({
        type: "broadcast",
        event: "bet.placed",
        payload: {
          id: betId,
          user_name: userName,
          user_id,
          outcome_key,
          outcome_label: outcome_label || outcome_key,
          outcome_color: outcomeColor,
          amount,
          potential_win: +(amount * payoutPerUnit).toFixed(2),
          ts: Date.now(),
        },
      });
      await supabase.removeChannel(broadcastChannel);
    } catch (broadcastErr) {
      console.error("[markets/bet] Broadcast error:", broadcastErr);
    }

    return NextResponse.json({
      ok: true,
      bet: { id: betId, payout_at_entry: payoutPerUnit, entry_price: entryPrice },
      market: { ...market, outcomes: updatedOutcomes, pool_total: newTotal },
      balance: newBalance,
    });
  } catch (err) {
    console.error("[markets/bet] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
