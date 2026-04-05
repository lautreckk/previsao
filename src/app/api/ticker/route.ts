export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// In-memory cache to avoid hammering external APIs
let cache: { data: TickerData; expiresAt: number } | null = null;
const CACHE_TTL = 60_000; // 60s — ticker doesn't need real-time

interface TickerData {
  forex: Record<string, number>;
  crypto: Record<string, number>;
  marketCount: number;
  updatedAt: string;
}

async function fetchForex(): Promise<Record<string, number>> {
  const pairs = "USD-BRL,EUR-BRL,EUR-USD";
  const res = await fetch(
    `https://economia.awesomeapi.com.br/json/last/${pairs}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`AwesomeAPI ${res.status}`);
  const json = await res.json();
  return {
    "USD/BRL": parseFloat(json.USDBRL.bid),
    "EUR/BRL": parseFloat(json.EURBRL.bid),
    "EUR/USD": parseFloat(json.EURUSD.bid),
  };
}

async function fetchCrypto(): Promise<Record<string, number>> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  return {
    BTC: json.bitcoin.usd,
    ETH: json.ethereum.usd,
  };
}

async function fetchMarketCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("markets")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "pending"]);
  return count ?? 0;
}

async function getTickerData(): Promise<TickerData> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;

  const [forex, crypto, marketCount] = await Promise.all([
    fetchForex().catch(() => cache?.data.forex ?? { "USD/BRL": 0, "EUR/BRL": 0, "EUR/USD": 0 }),
    fetchCrypto().catch(() => cache?.data.crypto ?? { BTC: 0, ETH: 0 }),
    fetchMarketCount().catch(() => cache?.data.marketCount ?? 0),
  ]);

  const data: TickerData = {
    forex,
    crypto,
    marketCount,
    updatedAt: new Date().toISOString(),
  };

  cache = { data, expiresAt: now + CACHE_TTL };
  return data;
}

export async function GET() {
  try {
    const data = await getTickerData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch ticker data" },
      { status: 502 }
    );
  }
}
