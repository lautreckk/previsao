export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = process.env.NODE_ENV !== "production"
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  : null;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { email, amount } = await request.json();

    if (!email || !amount || amount <= 0) {
      return NextResponse.json({ error: "email and positive amount required" }, { status: 400 });
    }

    // Find user by email
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, balance")
      .eq("email", email.toLowerCase())
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newBalance = Number(user.balance) + amount;

    // Update balance
    await supabase
      .from("users")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // Create ledger entry
    await supabase.from("ledger").insert({
      id: `ldg_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      type: "admin_adjustment",
      amount,
      balance_after: newBalance,
      description: "Test fund via Playwright",
    });

    return NextResponse.json({ ok: true, userId: user.id, balance: newBalance });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
