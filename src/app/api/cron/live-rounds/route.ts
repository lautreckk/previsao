export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron: Process live round ticks every minute.
 * Creates new rounds, transitions phases, resolves finished rounds.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.WEBHOOK_BASE_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/v1/live/rounds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({ action: "tick" }),
    });

    const data = await res.json();
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    console.error("[cron/live-rounds] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
