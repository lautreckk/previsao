export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjUzNDYsImV4cCI6MjA5MDIwMTM0Nn0.Mj_L0h3HGfG4X22Qb3f53oeipNXa91nIGW5-J_zl-kM"
);

function broadcast(marketId: string, event: string, payload: Record<string, unknown>) {
  const channelName = `cars-stream-${marketId}`;
  const channel = supabase.channel(channelName);
  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      channel.send({ type: "broadcast", event, payload })
        .catch(() => {})
        .finally(() => { supabase.removeChannel(channel); });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      supabase.removeChannel(channel);
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id, count, timestamp, secret, event_type, vehicle_id } = body;

    if (secret !== process.env.WORKER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!market_id) {
      return NextResponse.json({ error: "market_id required" }, { status: 400 });
    }

    // Type 1: Individual vehicle detection event
    if (event_type === "vehicle.detected" && vehicle_id) {
      broadcast(market_id, "vehicle.detected", {
        idKey: vehicle_id,
        time: timestamp || Date.now(),
        type: "vehicle",
      });
      return NextResponse.json({ ok: true, event: "vehicle.detected", vehicle_id });
    }

    // Type 2: Count sync (periodic bulk update)
    // FIX: Only accept counts during "betting" phase
    if (count !== undefined) {
      const { data: market } = await supabase
        .from("camera_markets")
        .select("phase")
        .eq("id", market_id)
        .maybeSingle();

      // Only update count during betting phase — ignore during observation/waiting
      if (market?.phase !== "betting") {
        return NextResponse.json({
          ok: false,
          ignored: true,
          reason: `Phase is '${market?.phase}', only accepting counts during 'betting'`,
          phase: market?.phase,
        });
      }

      await supabase
        .from("camera_markets")
        .update({ current_count: count, updated_at: timestamp || new Date().toISOString() })
        .eq("id", market_id);

      broadcast(market_id, "count.sync", { count, timestamp });
      return NextResponse.json({ ok: true, count });
    }

    // Type 3: Round reset — FIX: also update database, not just cache
    if (event_type === "round.reset") {
      await supabase
        .from("camera_markets")
        .update({ current_count: 0, updated_at: new Date().toISOString() })
        .eq("id", market_id);

      broadcast(market_id, "round.reset", { count: 0 });
      return NextResponse.json({ ok: true, event: "round.reset", count: 0 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("[camera/ingest] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET: Polling fallback — always read from DB (no in-memory cache in serverless)
export async function GET(request: NextRequest) {
  const marketId = request.nextUrl.searchParams.get("market_id");
  if (!marketId) return NextResponse.json({ error: "market_id required" }, { status: 400 });

  const { data } = await supabase
    .from("camera_markets")
    .select("current_count, phase")
    .eq("id", marketId)
    .maybeSingle();

  return NextResponse.json({ count: data?.current_count || 0, phase: data?.phase || "unknown", source: "db" });
}
