export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/prices — Public price endpoint (no auth required)
 * Used by frontend components to display live prices
 *
 * Query params:
 *   symbol   - BTC, ETH, SOL, USD/BRL, PETR4, etc.
 *   category - crypto, forex, stocks
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTC";
  const category = searchParams.get("category") || "crypto";

  try {
    let price = 0;
    let change = 0;
    let changePct = 0;
    let source = "";

    if (category === "crypto") {
      // CoinGecko (free, no key, no CORS issues)
      const cgIds: Record<string, string> = {
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
        XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche-2",
        LINK: "chainlink", DOT: "polkadot",
      };
      const cgId = cgIds[symbol.toUpperCase()] || symbol.toLowerCase();

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${cgId}&sparkline=false&price_change_percentage=24h`
      );
      if (res.ok) {
        const data = await res.json();
        const coin = data[0];
        if (coin) {
          price = coin.current_price;
          change = coin.price_change_24h;
          changePct = coin.price_change_percentage_24h;
          source = "coingecko";
        }
      }
    } else if (category === "forex") {
      // AwesomeAPI (free, no key)
      const pair = symbol.replace("/", "-");
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`);
      if (res.ok) {
        const data = await res.json();
        const key = pair.replace("-", "");
        const entry = data[key];
        if (entry) {
          price = parseFloat(entry.bid);
          change = parseFloat(entry.varBid);
          changePct = parseFloat(entry.pctChange);
          source = "awesomeapi";
        }
      }
    } else if (category === "stocks") {
      // brapi.dev (free tier)
      const token = process.env.BRAPI_TOKEN || "";
      const url = token
        ? `https://brapi.dev/api/quote/${symbol}?token=${token}`
        : `https://brapi.dev/api/quote/${symbol}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const stock = data.results?.[0];
        if (stock) {
          price = stock.regularMarketPrice;
          change = stock.regularMarketChange;
          changePct = stock.regularMarketChangePercent;
          source = "brapi";
        }
      }
    } else if (category === "weather") {
      // OpenWeather
      const owKey = process.env.OPENWEATHER_API_KEY;
      if (owKey) {
        const cities: Record<string, number> = {
          "sao paulo": 3448439, "rio de janeiro": 3451190, "brasilia": 3469058,
          "curitiba": 3464975, "belo horizonte": 3470127, "porto alegre": 3452925,
          "fortaleza": 3399415, "salvador": 3450554, "florianopolis": 3463237,
        };
        const cityId = cities[symbol.toLowerCase()] || 3448439;
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${owKey}&units=metric&lang=pt_br`
        );
        if (res.ok) {
          const data = await res.json();
          price = data.main.temp;
          change = data.main.temp - data.main.feels_like;
          changePct = 0;
          source = "openweather";
        }
      }
    }

    return NextResponse.json({
      symbol,
      category,
      price,
      change_24h: change,
      change_pct_24h: changePct,
      currency: category === "weather" ? "°C" : "BRL",
      source,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), symbol, price: 0 }, { status: 502 });
  }
}
