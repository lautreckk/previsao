export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

/**
 * GET /api/bots/active
 * Returns 30 random bot users with balance > 10 for the bot engine.
 * Note: Returns only bot IDs/names/balance — no sensitive data.
 */
export async function GET() {
  try {
    // Get random bots with sufficient balance
    const { data, error } = await supabase
      .from("users")
      .select("id, name, balance, level, total_predictions")
      .eq("is_bot", true)
      .gt("balance", 10)
      .limit(100);

    if (error || !data) {
      return NextResponse.json({ bots: [] });
    }

    // Shuffle and take 30
    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 30);

    return NextResponse.json(
      { bots: shuffled },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json({ bots: [] });
  }
}
