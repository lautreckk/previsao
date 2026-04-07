export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

/**
 * Cron: tick all active camera markets every minute (server-side, no client dependency)
 * This ensures rounds auto-advance even when no clients are connected.
 */
function isWithinOperatingHours(operatingHours: string | null): boolean {
  if (!operatingHours) return true; // no restriction = always active
  const match = operatingHours.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return true;

  const [, startH, startM, endH, endM] = match.map(Number);
  // Current time in Brazil (UTC-3)
  const now = new Date();
  const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const currentMinutes = brTime.getUTCHours() * 60 + brTime.getUTCMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Overnight range (e.g. 22:00-06:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown>[] = [];

  // Get all active camera markets
  const { data: markets } = await supabase
    .from("camera_markets")
    .select("id, phase, phase_ends_at, operating_hours")
    .in("status", ["waiting", "open"]);

  if (!markets || markets.length === 0) {
    return NextResponse.json({ ok: true, message: "No active camera markets", results: [] });
  }

  const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  const origin = baseUrl?.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  for (const market of markets) {
    // Check operating hours — skip cameras outside their active window
    if (!isWithinOperatingHours(market.operating_hours)) {
      // If camera is mid-round, let it finish; only block new rounds
      if (market.phase === "waiting") {
        results.push({ market_id: market.id, action: "outside_hours", operating_hours: market.operating_hours });
        continue;
      }
    }

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
