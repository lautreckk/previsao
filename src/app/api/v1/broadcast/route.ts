export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type BroadcastEvent = "odds.update" | "market.resolved" | "price.update" | "trade.new";

interface BroadcastPayload {
  channel: string;
  event: BroadcastEvent;
  data: Record<string, unknown>;
}

// POST /api/v1/broadcast
// Body: { channel, event, data }
// Called internally after bet placement or market resolution
export async function POST(request: NextRequest) {
  try {
    // Authenticate via x-api-key header
    const apiKey = request.headers.get("x-api-key");
    const validKeys = [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(Boolean);

    if (!apiKey || !validKeys.includes(apiKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BroadcastPayload = await request.json();
    const { channel, event, data } = body;

    if (!channel || !event || !data) {
      return NextResponse.json(
        { error: "Missing required fields: channel, event, data" },
        { status: 400 }
      );
    }

    const allowedEvents: BroadcastEvent[] = [
      "odds.update",
      "market.resolved",
      "price.update",
      "trade.new",
    ];

    if (!allowedEvents.includes(event as BroadcastEvent)) {
      return NextResponse.json(
        { error: `Invalid event type. Allowed: ${allowedEvents.join(", ")}` },
        { status: 400 }
      );
    }

    // Broadcast via Supabase Realtime
    const realtimeChannel = supabase.channel(channel);

    const result = await realtimeChannel.send({
      type: "broadcast",
      event,
      payload: { ...data, _ts: Date.now() },
    });

    // Unsubscribe after sending (we only need to send, not listen)
    await supabase.removeChannel(realtimeChannel);

    if (result !== "ok") {
      console.error("[broadcast] Failed to send:", result);
      return NextResponse.json(
        { error: "Broadcast failed", detail: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, channel, event });
  } catch (err) {
    console.error("[broadcast] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
