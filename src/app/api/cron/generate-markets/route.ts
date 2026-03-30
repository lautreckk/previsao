export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Cron endpoint: generates markets every hour
// Configured in vercel.json: "0 * * * *" (every hour)
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.WEBHOOK_BASE_URL || "http://localhost:3000";

  try {
    // Determine time of day to decide market mix
    const hour = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false });
    const h = parseInt(hour);

    let count = 5;
    let categories: string[] | undefined;

    // Night (0-8): fewer markets, more crypto/economy (24h markets)
    if (h >= 0 && h < 8) {
      count = 2;
      categories = ["crypto", "economy"];
    }
    // Morning (8-12): stories, weather, sports
    else if (h >= 8 && h < 12) {
      count = 5;
      categories = ["entertainment", "weather", "sports", "economy"];
    }
    // Afternoon (12-18): full mix, peak hours
    else if (h >= 12 && h < 18) {
      count = 7;
    }
    // Night (18-24): entertainment, sports, crypto
    else {
      count = 5;
      categories = ["entertainment", "sports", "crypto", "economy"];
    }

    const res = await fetch(`${baseUrl}/api/markets/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ secret: process.env.ADMIN_SECRET || "admin", count, categories }),
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      hour: h,
      count,
      categories,
      result: data,
    });
  } catch (err) {
    console.error("[cron/generate-markets] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
