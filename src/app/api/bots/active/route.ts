export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/bots/active
 * Returns 30 random bot users with balance > 10 for the bot engine.
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
