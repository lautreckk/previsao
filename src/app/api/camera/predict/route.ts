export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id, prediction_type, amount, user_id } = body;

    if (!market_id || !user_id || !prediction_type || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (prediction_type !== "over" && prediction_type !== "under") {
      return NextResponse.json({ error: "prediction_type must be 'over' or 'under'" }, { status: 400 });
    }
    if (amount < 1) {
      return NextResponse.json({ error: "Valor minimo R$ 1,00" }, { status: 400 });
    }

    // Check user balance
    const { data: user } = await supabase.from("users").select("balance").eq("id", user_id).maybeSingle();
    if (!user || Number(user.balance) < amount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Check market is in betting phase
    const { data: market } = await supabase
      .from("camera_markets")
      .select("phase, current_threshold, round_number")
      .eq("id", market_id)
      .maybeSingle();

    if (!market || market.phase !== "betting") {
      return NextResponse.json({ error: "Previsoes encerradas para esta rodada" }, { status: 400 });
    }

    // Get active round
    const roundId = `cr_${market_id}_${market.round_number}`;
    const { data: round } = await supabase
      .from("camera_rounds")
      .select("pool_over, pool_under, total_pool")
      .eq("id", roundId)
      .maybeSingle();

    if (!round) {
      return NextResponse.json({ error: "Rodada nao encontrada" }, { status: 400 });
    }

    // Calculate current odds before this bet
    const poolOver = Number(round.pool_over) + (prediction_type === "over" ? amount : 0);
    const poolUnder = Number(round.pool_under) + (prediction_type === "under" ? amount : 0);
    const totalPool = poolOver + poolUnder;
    const myPool = prediction_type === "over" ? poolOver : poolUnder;
    const oddsAtEntry = myPool > 0 ? (totalPool * 0.95) / myPool : 1;

    // Debit balance
    const newBalance = Number(user.balance) - amount;
    await supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", user_id);

    // Insert prediction
    const predId = `cpred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { data: prediction, error } = await supabase
      .from("camera_predictions")
      .insert({
        id: predId,
        user_id,
        market_id,
        round_id: roundId,
        prediction_type,
        threshold: market.current_threshold,
        amount_brl: amount,
        odds_at_entry: Math.round(oddsAtEntry * 100) / 100,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      // Rollback balance
      await supabase.from("users").update({ balance: Number(user.balance) }).eq("id", user_id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update round pools
    await supabase
      .from("camera_rounds")
      .update({
        pool_over: poolOver,
        pool_under: poolUnder,
        total_pool: totalPool,
      })
      .eq("id", roundId);

    // Ledger entry
    await supabase.from("ledger").insert({
      id: `ldg_cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id,
      type: "bet_placed",
      amount: -amount,
      balance_after: newBalance,
      reference_id: predId,
      description: `Previsao Camera: ${prediction_type.toUpperCase()} ${market.current_threshold} veiculos`,
    });

    // Broadcast updated odds (fire-and-forget)
    supabase.channel(`cars-stream-${market_id}`).send({
      type: "broadcast",
      event: "odds.update",
      payload: {
        pool_over: poolOver,
        pool_under: poolUnder,
        total_pool: totalPool,
        odds_over: poolOver > 0 ? Math.round(((totalPool * 0.95) / poolOver) * 100) / 100 : 0,
        odds_under: poolUnder > 0 ? Math.round(((totalPool * 0.95) / poolUnder) * 100) / 100 : 0,
      },
    });

    return NextResponse.json({
      prediction,
      newBalance,
      odds: {
        over: poolOver > 0 ? Math.round(((totalPool * 0.95) / poolOver) * 100) / 100 : 0,
        under: poolUnder > 0 ? Math.round(((totalPool * 0.95) / poolUnder) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    console.error("[camera/predict] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const marketId = request.nextUrl.searchParams.get("market_id");
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!marketId || !userId) {
    return NextResponse.json({ error: "market_id and user_id required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("camera_predictions")
    .select("*")
    .eq("market_id", marketId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ predictions: data || [] });
}
