export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjUzNDYsImV4cCI6MjA5MDIwMTM0Nn0.Mj_L0h3HGfG4X22Qb3f53oeipNXa91nIGW5-J_zl-kM"
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id, round_id, predicted_min, predicted_max, amount, user_id } = body;

    if (!market_id || !user_id || predicted_min === undefined || predicted_max === undefined || !amount) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (amount < 1) {
      return NextResponse.json({ error: "Valor minimo R$ 1,00" }, { status: 400 });
    }

    // Check user balance
    const { data: user } = await supabase.from("users").select("balance").eq("id", user_id).maybeSingle();
    if (!user || Number(user.balance) < amount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Check market is open
    const { data: market } = await supabase.from("camera_markets").select("status").eq("id", market_id).maybeSingle();
    if (!market || market.status !== "open") {
      return NextResponse.json({ error: "Mercado nao esta aberto" }, { status: 400 });
    }

    // Get current round
    let activeRoundId = round_id;
    if (!activeRoundId) {
      const { data: round } = await supabase
        .from("camera_rounds")
        .select("id")
        .eq("market_id", market_id)
        .is("resolved_at", null)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeRoundId = round?.id;
    }

    // Debit balance
    const newBalance = Number(user.balance) - amount;
    await supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", user_id);

    // Insert prediction
    const predId = `cpred_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { data: prediction, error } = await supabase.from("camera_predictions").insert({
      id: predId,
      user_id,
      market_id,
      round_id: activeRoundId || null,
      predicted_min,
      predicted_max,
      amount_brl: amount,
      status: "open",
    }).select().single();

    if (error) {
      // Rollback balance
      await supabase.from("users").update({ balance: Number(user.balance) }).eq("id", user_id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ledger entry
    await supabase.from("ledger").insert({
      id: `ldg_cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id,
      type: "bet_placed",
      amount: -amount,
      balance_after: newBalance,
      reference_id: predId,
      description: `Previsao Camera: ${predicted_min}-${predicted_max} veiculos`,
    });

    return NextResponse.json({ prediction, newBalance });
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