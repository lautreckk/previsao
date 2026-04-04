export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

/**
 * Cron: tick all active camera markets every minute (server-side, no client dependency)
 * This ensures rounds auto-advance even when no clients are connected.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown>[] = [];

  // Get all active camera markets
  const { data: markets } = await supabase
    .from("camera_markets")
    .select("id, phase, phase_ends_at")
    .in("status", ["waiting", "open"]);

  if (!markets || markets.length === 0) {
    return NextResponse.json({ ok: true, message: "No active camera markets", results: [] });
  }

  const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  const origin = baseUrl?.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  for (const market of markets) {
    const now = Date.now();
    const phaseEndsAt = market.phase_ends_at ? new Date(market.phase_ends_at).getTime() : null;
    const shouldTick = market.phase === "waiting" || (phaseEndsAt && now >= phaseEndsAt);

    if (!shouldTick) {
      results.push({ market_id: market.id, action: "no_op", phase: market.phase });
      continue;
    }

    try {
      const res = await fetch(`${origin}/api/camera/round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: market.id, secret: process.env.WORKER_SECRET }),
      });
      const data = await res.json();
      results.push({ market_id: market.id, ...data });
    } catch (err) {
      results.push({ market_id: market.id, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, results, timestamp: new Date().toISOString() });
}
