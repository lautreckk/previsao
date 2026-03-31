export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { generateAutoMarkets, resolveExpiredMarkets } from "../../v1/auto-markets/engine";

/**
 * Cron: Auto-create and auto-resolve real markets
 *
 * Schedule: every 10 minutes
 * 1. Resolve expired markets (fetch real data, pay winners)
 * 2. Create new markets based on time of day
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

  return NextResponse.json({ ok: true, ...results, timestamp: new Date().toISOString() });
}
