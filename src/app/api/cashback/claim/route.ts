export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

const MIN_CASHBACK_CLAIM = 1.00; // Minimum R$1 to claim

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const { data: user } = await supabase
      .from("users")
      .select("id, cashback_balance, balance")
      .eq("id", user_id)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const cashback = Number(user.cashback_balance || 0);
    if (cashback < MIN_CASHBACK_CLAIM) {
      return NextResponse.json({
        error: `Minimo de R$ ${MIN_CASHBACK_CLAIM.toFixed(2)} para resgatar`,
        cashback_balance: cashback,
      }, { status: 400 });
    }

    // Credit cashback to balance
    const { error: rpcErr } = await supabase.rpc("increment_balance", {
      user_id_param: user_id,
      amount_param: cashback,
    });

    if (rpcErr) {
      return NextResponse.json({ error: "Failed to credit cashback" }, { status: 500 });
    }

    // Reset cashback balance
    await supabase.from("users").update({
      cashback_balance: 0,
      updated_at: new Date().toISOString(),
    }).eq("id", user_id);

    // Ledger entry
    const { data: updatedUser } = await supabase.from("users").select("balance").eq("id", user_id).maybeSingle();
    await supabase.from("ledger").insert({
      id: `ldg_cashback_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id,
      type: "cashback",
      amount: cashback,
      balance_after: Number(updatedUser?.balance ?? 0),
      description: `Resgate de cashback — R$ ${cashback.toFixed(2)}`,
    });

    return NextResponse.json({
      claimed: true,
      amount: cashback,
      new_balance: Number(updatedUser?.balance ?? 0),
    });
  } catch (error) {
    console.error("[cashback/claim] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
