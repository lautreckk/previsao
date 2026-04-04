export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, checkAdminSecret, unauthorized } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  // Double protection: NODE_ENV check + admin auth required
  if (process.env.NODE_ENV === "production" && !checkAdminSecret(request)) {
    return unauthorized();
  }

  if (!checkAdminSecret(request)) {
    return unauthorized();
  }

  try {
    const { email, amount } = await request.json();

    if (!email || !amount || amount <= 0) {
      return NextResponse.json({ error: "email and positive amount required" }, { status: 400 });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, balance")
      .eq("email", email.toLowerCase())
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newBalance = Number(user.balance) + amount;

    await supabaseAdmin
      .from("users")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    await supabaseAdmin.from("ledger").insert({
      id: `ldg_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      type: "admin_adjustment",
      amount,
      balance_after: newBalance,
      description: "Test fund via admin",
    });

    return NextResponse.json({ ok: true, userId: user.id, balance: newBalance });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
