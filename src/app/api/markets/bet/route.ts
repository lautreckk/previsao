export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      .select("balance")
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

    // Calculate payout
    const outcomes = market.outcomes || [];
    const totalPool = Number(market.pool_total) || 0;
    const outcomeObj = outcomes.find((o: { key: string }) => o.key === outcome_key);
    const outcomePool = outcomeObj ? Number(outcomeObj.pool) || 0 : 0;
    const newTotal = totalPool + amount;
    const newOutcomePool = outcomePool + amount;
    const fee = Number(market.house_fee_percent) || 0.05;
    const payoutPerUnit = newOutcomePool > 0 ? (newTotal * (1 - fee)) / newOutcomePool : 1;

    // Deduct balance
    const newBalance = Number(userData.balance) - amount;
    await supabase
      .from("users")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user_id);

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
      status: "pending",
    });

    // Update market pools
    const updatedOutcomes = outcomes.map((o: { key: string; pool: number; bet_count: number; unique_users: number; payout_per_unit: number }) => {
      if (o.key === outcome_key) {
        const newPool = (Number(o.pool) || 0) + amount;
        return {
          ...o,
          pool: newPool,
          bet_count: (o.bet_count || 0) + 1,
          unique_users: (o.unique_users || 0) + 1,
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

    return NextResponse.json({
      ok: true,
      bet: { id: betId, payout_at_entry: payoutPerUnit },
      market: { ...market, outcomes: updatedOutcomes, pool_total: newTotal },
      balance: newBalance,
    });
  } catch (err) {
    console.error("[markets/bet] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
