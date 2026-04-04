export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAutoMarkets, resolveExpiredMarkets } from "../../v1/auto-markets/engine";

/**
 * Cron: Generate new markets + fallback resolution
 *
 * Schedule: every 10 minutes
 * 1. Fallback: resolve any markets missed by the job dispatcher (safety net)
 * 2. Create new markets based on time of day (+ schedule jobs for close/resolve)
 *
 * Primary resolution now happens via processMarketJobs() in the 1-min cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // Step 1: Resolve expired markets FIRST
  try {
    const resolveResult = await resolveExpiredMarkets();
    results.resolution = resolveResult;
  } catch (err) {
    results.resolution_error = String(err);
  }

  // Step 2: Create new markets based on time
  try {
    const hour = parseInt(
      new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })
    );

    // Determine which tiers to generate based on time
    let tiers: ("curto" | "medio" | "longo")[] = [];

    if (hour >= 0 && hour < 8) {
      // Madrugada: apenas crypto curto (24/7)
      tiers = ["curto"];
    } else if (hour >= 8 && hour < 12) {
      // Manha: curto + medio (crypto, clima, forex, acoes abrem 10h)
      tiers = ["curto", "medio"];
    } else if (hour >= 12 && hour < 18) {
      // Tarde: todos os tiers (peak hours)
      tiers = ["curto", "medio", "longo"];
    } else {
      // Noite: curto + medio (crypto, entretenimento)
      tiers = ["curto", "medio"];
    }

    const createResult = await generateAutoMarkets(tiers);
    results.creation = createResult;
    results.hour = hour;
    results.tiers = tiers;
  } catch (err) {
    results.creation_error = String(err);
  }

  // Step 3: Recalculate rank_position based on profit (total_returns - total_wagered)
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: users } = await supabase
      .from("users")
      .select("id, total_returns, total_wagered, total_predictions")
      .gt("total_predictions", 0)
      .order("total_predictions", { ascending: false })
      .limit(500);

    if (users && users.length > 0) {
      const sorted = users
        .map((u) => ({ id: u.id, profit: Number(u.total_returns || 0) - Number(u.total_wagered || 0) }))
        .sort((a, b) => b.profit - a.profit);

      for (let i = 0; i < sorted.length; i++) {
        await supabase.from("users").update({ rank_position: i + 1 }).eq("id", sorted[i].id);
      }
      results.ranking = { updated: sorted.length };
    }
  } catch (err) {
    results.ranking_error = String(err);
  }

  return NextResponse.json({ ok: true, ...results, timestamp: new Date().toISOString() });
}
