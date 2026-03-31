export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Symbols to snapshot
const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
const FOREX_PAIRS = ["USD-BRL", "EUR-BRL"];

/**
 * Cron: Capture price and weather snapshots every 5 minutes.
 * Used for historical charts and market resolution.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = sb();
  const results: { type: string; count: number; errors: string[] }[] = [];

  // 1. Crypto prices from Binance
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${JSON.stringify(CRYPTO_SYMBOLS)}`
    );
    if (res.ok) {
      const prices = await res.json();
      const rows = prices.map((p: { symbol: string; price: string }) => ({
        symbol: p.symbol.replace("USDT", ""),
        price: parseFloat(p.price),
        source: "binance",
      }));
      const { error } = await supabase.from("price_snapshots").insert(rows);
      results.push({ type: "crypto", count: rows.length, errors: error ? [error.message] : [] });
    }
  } catch (err) {
    results.push({ type: "crypto", count: 0, errors: [String(err)] });
  }

  // 2. Forex from AwesomeAPI
  try {
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${FOREX_PAIRS.join(",")}`);
    if (res.ok) {
      const data = await res.json();
      const rows = Object.values(data).map((d: unknown) => {
        const pair = d as { code: string; codein: string; bid: string };
        return {
          symbol: `${pair.code}/${pair.codein}`,
          price: parseFloat(pair.bid),
          source: "awesomeapi",
        };
      });
      const { error } = await supabase.from("price_snapshots").insert(rows);
      results.push({ type: "forex", count: rows.length, errors: error ? [error.message] : [] });
    }
  } catch (err) {
    results.push({ type: "forex", count: 0, errors: [String(err)] });
  }

  // 3. Weather for main cities
  const owKey = process.env.OPENWEATHER_API_KEY;
  if (owKey) {
    const cities = [
      { slug: "sao-paulo", id: 3448439 },
      { slug: "rio-de-janeiro", id: 3451190 },
      { slug: "brasilia", id: 3469058 },
      { slug: "belo-horizonte", id: 3470127 },
      { slug: "curitiba", id: 3464975 },
    ];
    try {
      const weatherRows = await Promise.all(
        cities.map(async (c) => {
          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?id=${c.id}&appid=${owKey}&units=metric`
          );
          if (!res.ok) return null;
          const d = await res.json();
          return {
            city: c.slug,
            temperature: Math.round(d.main.temp * 10) / 10,
            humidity: d.main.humidity,
            description: d.weather?.[0]?.description || "",
          };
        })
      );
      const valid = weatherRows.filter(Boolean);
      if (valid.length > 0) {
        const { error } = await supabase.from("weather_snapshots").insert(valid);
        results.push({ type: "weather", count: valid.length, errors: error ? [error.message] : [] });
      }
    } catch (err) {
      results.push({ type: "weather", count: 0, errors: [String(err)] });
    }
  }

  return NextResponse.json({
    ok: true,
    snapshots: results,
    timestamp: new Date().toISOString(),
  });
}
