export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

// Daily bonus amounts by streak day (R$)
const BONUS_SCHEDULE = [0.50, 0.75, 1.00, 1.50, 2.00, 3.00, 5.00];

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const { data: user } = await supabase
      .from("users")
      .select("id, last_daily_bonus, daily_streak, balance")
      .eq("id", user_id)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Already claimed today
    if (user.last_daily_bonus === today) {
      return NextResponse.json({
        already_claimed: true,
        daily_streak: user.daily_streak,
        next_bonus: BONUS_SCHEDULE[Math.min((user.daily_streak || 0), BONUS_SCHEDULE.length - 1)],
      });
    }

    // Calculate streak
    const isConsecutive = user.last_daily_bonus === yesterday;
    const newStreak = isConsecutive ? Math.min((user.daily_streak || 0) + 1, BONUS_SCHEDULE.length) : 1;
    const bonusIndex = Math.min(newStreak - 1, BONUS_SCHEDULE.length - 1);
    const bonusAmount = BONUS_SCHEDULE[bonusIndex];

    // Credit bonus
    const { error: rpcErr } = await supabase.rpc("increment_balance", {
      user_id_param: user_id,
      amount_param: bonusAmount,
    });

    if (rpcErr) {
      return NextResponse.json({ error: "Failed to credit bonus" }, { status: 500 });
    }

    // Update streak
    await supabase.from("users").update({
      last_daily_bonus: today,
      daily_streak: newStreak,
      updated_at: new Date().toISOString(),
    }).eq("id", user_id);

    // Ledger entry
    const { data: updatedUser } = await supabase.from("users").select("balance").eq("id", user_id).maybeSingle();
    await supabase.from("ledger").insert({
      id: `ldg_daily_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id,
      type: "daily_bonus",
      amount: bonusAmount,
      balance_after: Number(updatedUser?.balance ?? 0),
      description: `Bonus diario dia ${newStreak} — R$ ${bonusAmount.toFixed(2)}`,
    });

    return NextResponse.json({
      claimed: true,
      bonus_amount: bonusAmount,
      daily_streak: newStreak,
      next_bonus: BONUS_SCHEDULE[Math.min(newStreak, BONUS_SCHEDULE.length - 1)],
      max_streak: BONUS_SCHEDULE.length,
    });
  } catch (error) {
    console.error("[daily-bonus] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
