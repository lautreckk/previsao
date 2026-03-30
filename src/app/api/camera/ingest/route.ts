export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxeW1hbG1iYnR6ZG5wYm5lZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjUzNDYsImV4cCI6MjA5MDIwMTM0Nn0.Mj_L0h3HGfG4X22Qb3f53oeipNXa91nIGW5-J_zl-kM"
);

// Store latest count per market (in-memory cache for serverless)
const countCache = new Map<string, number>();

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
      // Broadcast to realtime channel (fire-and-forget)
      supabase.channel(`cars-stream-${market_id}`).send({
        type: "broadcast",
        event: "vehicle.detected",
        payload: {
          idKey: vehicle_id,
          time: timestamp || Date.now(),
          type: "vehicle",
        },
      });

      return NextResponse.json({ ok: true, event: "vehicle.detected", vehicle_id });
    }

    // Type 2: Count sync (periodic bulk update)
    if (count !== undefined) {
      countCache.set(market_id, count);

      // Update database
      await supabase
        .from("camera_markets")
        .update({ current_count: count, updated_at: timestamp || new Date().toISOString() })
        .eq("id", market_id);

      // Broadcast count sync (fire-and-forget)
      supabase.channel(`cars-stream-${market_id}`).send({
        type: "broadcast",
        event: "count.sync",
        payload: { count, timestamp },
      });

      return NextResponse.json({ ok: true, count });
    }

    // Type 3: Round reset
    if (event_type === "round.reset") {
      countCache.set(market_id, 0);
      supabase.channel(`cars-stream-${market_id}`).send({
        type: "broadcast",
        event: "round.reset",
        payload: {},
      });
      return NextResponse.json({ ok: true, event: "round.reset" });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("[camera/ingest] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET: Polling fallback for count
export async function GET(request: NextRequest) {
  const marketId = request.nextUrl.searchParams.get("market_id");
  if (!marketId) return NextResponse.json({ error: "market_id required" }, { status: 400 });

  const cached = countCache.get(marketId);
  if (cached !== undefined) {
    return NextResponse.json({ count: cached, source: "cache" });
  }

  const { data } = await supabase
    .from("camera_markets")
    .select("current_count")
    .eq("id", marketId)
    .maybeSingle();

  return NextResponse.json({ count: data?.current_count || 0, source: "db" });
}